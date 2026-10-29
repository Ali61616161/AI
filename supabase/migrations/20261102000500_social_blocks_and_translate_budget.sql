-- =============================================================================
-- Gezginler: engellenenler listesi (engeli kaldırma), şikayet bütünlüğü, sahte hesapla toplu şikayetle askıya
-- aldırmanın önlenmesi; çeviri için günlük karakter bütçesi.
-- =============================================================================

-- Engellediklerim: profiller başkalarına kapalı olduğundan görünen ad/fotoğraf bu işlevle gelir.
create or replace function public.my_blocks()
returns table (blocked_id uuid, display_name text, avatar_url text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select b.blocked_id, p.display_name, p.avatar_url, b.created_at
  from public.user_blocks b
  left join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;
revoke execute on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

-- Şikayetteki davet, şikayet edenin kendi daveti ve şikayet edilenle olan davet olmalı (başkasının davetine bağlanamaz).
create or replace function public.user_reports_check_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invite_id is not null and not exists (
    select 1 from public.match_invites i
    where i.id = new.invite_id
      and ((i.from_user = new.reporter_id and i.to_user = new.reported_id) or (i.from_user = new.reported_id and i.to_user = new.reporter_id))
  ) then
    new.invite_id := null;
  end if;
  return new;
end;
$$;

create trigger user_reports_check_invite before insert on public.user_reports
  for each row execute function public.user_reports_check_invite();

-- Otomatik askı: üç sahte hesap birine toplu şikayet atıp onu görünmez yapamasın. Yalnızca şikayet edilenle gerçek bir
-- etkileşimi olanlar sayılır: şikayet eden ya ondan davet almıştır ya da davet karşılıklı kabul edilmiştir. Yakındaki
-- listeden tek başına gelen şikayetler (etkileşimsiz) kaydedilir ve ekibin incelemesine kalır, otomatik askıya almaz.
create or replace function public.user_reports_auto_suspend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(distinct r.reporter_id)
    from public.user_reports r
    where r.reported_id = new.reported_id
      and r.created_at > now() - interval '30 days'
      and exists (
        select 1 from public.match_invites i
        where (i.from_user = r.reported_id and i.to_user = r.reporter_id)
           or (i.status = 'accepted' and i.from_user = r.reporter_id and i.to_user = r.reported_id)
      )
  ) >= 3 then
    insert into public.social_suspensions (user_id, suspended_until)
    values (new.reported_id, now() + interval '14 days')
    on conflict (user_id) do update set suspended_until = greatest(public.social_suspensions.suspended_until, excluded.suspended_until);

    update public.social_profiles set is_visible = false where user_id = new.reported_id and is_visible;
    update public.match_invites
      set status = 'cancelled', responded_at = now()
      where status in ('pending', 'accepted') and new.reported_id in (from_user, to_user);
  end if;
  return new;
end;
$$;

-- Çeviri bütçesi: kullanıcı başına günde en çok p_cap karakter (Google Cloud Translation maliyetini sınırlar).
-- Yalnızca Edge Function'lar (service_role) çağırır; istemci erişemez.
create table public.translate_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null default current_date,
  chars integer not null default 0,
  primary key (user_id, day)
);
alter table public.translate_usage enable row level security;
revoke all on public.translate_usage from anon, authenticated;

create or replace function public.consume_translate_chars(p_user uuid, p_chars integer, p_cap integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chars integer;
begin
  if p_chars <= 0 then
    return true;
  end if;
  insert into public.translate_usage (user_id, day, chars) values (p_user, current_date, p_chars)
  on conflict (user_id, day) do update set chars = public.translate_usage.chars + p_chars
    where public.translate_usage.chars + p_chars <= p_cap
  returning chars into v_chars;
  return v_chars is not null;
end;
$$;
revoke execute on function public.consume_translate_chars(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_translate_chars(uuid, integer, integer) to service_role;
