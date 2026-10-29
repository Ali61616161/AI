-- =============================================================================
-- Gezginler moderasyonu: şikayetler otomatik askıya almaz, ekibe düşer ve sohbet delilleriyle incelenir.
-- Mesaj silme (sahibi siler, kanıt 30 gün saklanır), mesaj şikayeti, yönetici işlevleri.
-- =============================================================================

-- 1. Otomatik askı kalktı: troll/sahte hesap şikayetiyle kimse görünmez yapılamasın. Askıyı yalnızca moderatör uygular.
drop trigger if exists user_reports_auto_suspend on public.user_reports;
drop function if exists public.user_reports_auto_suspend();

-- 2. Şikayet kayıtları: delil (sohbetin anlık görüntüsü), şikayet edilen mesaj, inceleme durumu.
alter table public.user_reports
  add column message_id bigint,
  add column evidence jsonb,
  add column resolution text check (resolution in ('dismissed', 'warned', 'suspended', 'banned')),
  add column resolved_at timestamptz;
alter table public.user_reports drop constraint if exists user_reports_status_check;
alter table public.user_reports add constraint user_reports_status_check check (status in ('open', 'reviewing', 'resolved'));

-- 3. Mesajlar: sahibi silebilir (yumuşak silme). Silinen mesaj taraflara görünmez; şikayet delili için 30 gün saklanır.
alter table public.messages add column deleted_at timestamptz;
drop policy if exists "messages: taraflar okur" on public.messages;
create policy "messages: taraflar okur" on public.messages
  for select to authenticated using (deleted_at is null and public.is_invite_participant(invite_id, false));

create or replace function public.delete_message(p_message_id bigint)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.messages set deleted_at = now()
  where id = p_message_id and sender_id = auth.uid() and deleted_at is null;
  if not found then
    raise exception 'message not found' using errcode = '42501';
  end if;
end;
$$;
revoke execute on function public.delete_message(bigint) from public, anon;
grant execute on function public.delete_message(bigint) to authenticated;

-- Silinen mesaj son mesaj olarak görünmesin.
create or replace function public.my_invites()
returns table (
  id uuid,
  incoming boolean,
  status public.invite_status,
  place_name text,
  google_place_id text,
  place_lat double precision,
  place_lng double precision,
  meet_at timestamptz,
  message text,
  created_at timestamptz,
  other_id uuid,
  other_name text,
  other_avatar text,
  other_verified boolean,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.to_user = auth.uid(),
    i.status,
    i.place_name,
    i.google_place_id,
    extensions.st_y(i.place_location::extensions.geometry),
    extensions.st_x(i.place_location::extensions.geometry),
    i.meet_at,
    i.message,
    i.created_at,
    o.id,
    o.display_name,
    o.avatar_url,
    o.identity_verified_at is not null,
    m.body,
    m.created_at
  from public.match_invites i
  join public.profiles o on o.id = case when i.from_user = auth.uid() then i.to_user else i.from_user end
  left join lateral (
    select body, created_at from public.messages where invite_id = i.id and deleted_at is null order by created_at desc limit 1
  ) m on true
  where auth.uid() in (i.from_user, i.to_user)
    and not public.is_blocked_between(i.from_user, i.to_user)
    and i.created_at > now() - interval '60 days'
  order by coalesce(m.created_at, i.created_at) desc;
$$;
revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;

-- 4. Şikayet girişi: sistem alanları istemciden alınmaz; delil sunucuda toplanır.
--    Davet şikayet eden ile edilen arasında olmalı; mesaj o davette ve şikayet edilenin yazdığı olmalı.
--    Delil: davetin sonundan son 20 mesaj (silinenler dahil) + davet notu.
create or replace function public.user_reports_prepare()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.match_invites%rowtype;
  v_messages jsonb;
begin
  new.status := 'open';
  new.resolution := null;
  new.resolved_at := null;
  new.evidence := null;

  if new.invite_id is not null then
    select * into v_invite from public.match_invites i
    where i.id = new.invite_id
      and ((i.from_user = new.reporter_id and i.to_user = new.reported_id) or (i.from_user = new.reported_id and i.to_user = new.reporter_id));
    if not found then
      new.invite_id := null;
      new.message_id := null;
    end if;
  else
    new.message_id := null;
  end if;

  if new.message_id is not null and not exists (
    select 1 from public.messages m where m.id = new.message_id and m.invite_id = new.invite_id and m.sender_id = new.reported_id
  ) then
    new.message_id := null;
  end if;

  if new.invite_id is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'from', case when t.sender_id = new.reporter_id then 'reporter' else 'reported' end,
        'body', t.body,
        'at', t.created_at,
        'deleted', t.deleted_at is not null
      ) order by t.created_at), '[]'::jsonb)
    into v_messages
    from (
      select * from public.messages m where m.invite_id = new.invite_id order by m.created_at desc limit 20
    ) t;
    new.evidence := jsonb_build_object(
      'invite_message', v_invite.message,
      'place', v_invite.place_name,
      'meet_at', v_invite.meet_at,
      'invited_by', case when v_invite.from_user = new.reporter_id then 'reporter' else 'reported' end,
      'messages', v_messages
    );
  end if;
  return new;
end;
$$;

drop trigger if exists user_reports_check_invite on public.user_reports;
drop function if exists public.user_reports_check_invite();
create trigger user_reports_prepare before insert on public.user_reports
  for each row execute function public.user_reports_prepare();

-- 5. Moderatörler: yönetici e-postaları (doğrulanmış e-postalı hesap). Başkası eklemek için internal_config güncellenir.
insert into public.internal_config (key, value) values ('moderator_emails', 'info@akturangroup.com')
  on conflict (key) do nothing;

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and u.email_confirmed_at is not null
      and lower(u.email) = any (
        string_to_array(lower(replace(coalesce((select value from public.internal_config where key = 'moderator_emails'), ''), ' ', '')), ',')
      )
  );
$$;
revoke execute on function public.is_moderator() from public, anon;
grant execute on function public.is_moderator() to authenticated;

-- Bildirim için moderatör kullanıcı kimlikleri (yalnızca service_role).
create or replace function public.moderator_user_ids()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u
  where u.email_confirmed_at is not null
    and lower(u.email) = any (
      string_to_array(lower(replace(coalesce((select value from public.internal_config where key = 'moderator_emails'), ''), ' ', '')), ',')
    );
$$;
revoke execute on function public.moderator_user_ids() from public, anon, authenticated;
grant execute on function public.moderator_user_ids() to service_role;

-- 6. İnceleme kuyruğu (yalnızca moderatör): açık şikayetler, tarafların adları, delil ve şikayet edenin geçmişi.
create or replace function public.moderation_queue()
returns table (
  id uuid,
  created_at timestamptz,
  reason public.report_reason,
  details text,
  status text,
  resolution text,
  reporter_id uuid,
  reporter_name text,
  reported_id uuid,
  reported_name text,
  message_id bigint,
  evidence jsonb,
  reports_on_reported integer,
  reports_by_reporter integer,
  reported_suspended boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_moderator() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
  select
    r.id, r.created_at, r.reason, r.details, r.status, r.resolution,
    r.reporter_id, rp.display_name, r.reported_id, dp.display_name,
    r.message_id, r.evidence,
    (select count(*)::int from public.user_reports x where x.reported_id = r.reported_id),
    (select count(*)::int from public.user_reports x where x.reporter_id = r.reporter_id),
    exists (select 1 from public.social_suspensions s where s.user_id = r.reported_id and s.suspended_until > now())
  from public.user_reports r
  left join public.profiles rp on rp.id = r.reporter_id
  left join public.profiles dp on dp.id = r.reported_id
  where r.status <> 'resolved' or r.resolved_at > now() - interval '7 days'
  order by (r.status = 'resolved'), r.created_at desc
  limit 100;
end;
$$;
revoke execute on function public.moderation_queue() from public, anon;
grant execute on function public.moderation_queue() to authenticated;

-- Şikayeti karara bağlar. suspended: 14 gün, banned: kalıcı (sosyal modda görünmez, davet/mesaj yok).
create or replace function public.moderation_resolve(p_report_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reported uuid;
begin
  if not public.is_moderator() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action not in ('dismissed', 'warned', 'suspended', 'banned') then
    raise exception 'invalid action' using errcode = '22023';
  end if;
  select reported_id into v_reported from public.user_reports where id = p_report_id;
  if v_reported is null then
    raise exception 'report not found' using errcode = 'P0002';
  end if;

  if p_action in ('suspended', 'banned') then
    insert into public.social_suspensions (user_id, suspended_until, reason)
    values (v_reported, case when p_action = 'banned' then '2100-01-01'::timestamptz else now() + interval '14 days' end, 'moderator')
    on conflict (user_id) do update set suspended_until = greatest(public.social_suspensions.suspended_until, excluded.suspended_until);
    update public.social_profiles set is_visible = false where user_id = v_reported and is_visible;
    update public.match_invites set status = 'cancelled', responded_at = now()
      where status in ('pending', 'accepted') and v_reported in (from_user, to_user);
  end if;

  update public.user_reports set status = 'resolved', resolution = p_action, resolved_at = now() where id = p_report_id;
end;
$$;
revoke execute on function public.moderation_resolve(uuid, text) from public, anon;
grant execute on function public.moderation_resolve(uuid, text) to authenticated;

-- 7. Yeni şikayet gelince moderatörlere anlık bildirim (pg_net → notify-report). Başarısız olursa şikayet yine kaydedilir.
create or replace function public.user_reports_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := (select value from public.internal_config where key = 'functions_url') || '/notify-report',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from public.internal_secrets where key = 'cron')),
      body := jsonb_build_object('report_id', new.id),
      timeout_milliseconds := 10000
    );
  exception when others then
    raise notice 'notify-report çağrılamadı: %', sqlerrm;
  end;
  return new;
end;
$$;
create trigger user_reports_notify after insert on public.user_reports
  for each row execute function public.user_reports_notify();

-- 8. Silinen mesajların kanıt süresi 30 gün; sonra kalıcı silinir (şikayet delilleri kendi kopyasını taşır). Günlük 03:30.
do $$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule('purge-deleted-messages', '30 3 * * *', $job$ delete from public.messages where deleted_at < now() - interval '30 days' $job$);
exception when others then
  raise notice 'pg_cron kurulamadı, silinen mesaj temizliği zamanlanmadı: %', sqlerrm;
end;
$$;
