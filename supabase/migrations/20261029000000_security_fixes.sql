-- Güvenlik taraması düzeltmeleri (Ekim 2026).
--   1. Seyahat davetleri yalnızca e-postasını kanıtlamış hesaba görünür ve kabul edilebilir.
--   2. Seyahat sahibi davetsiz üye ekleyemez (yalnızca davet akışı).
--   3. Davet ödülü yalnızca sunucu gerçekten plan ürettiğinde verilir.
--   4. Buluşma daveti yalnızca sunucunun Google'dan doğruladığı halka açık mekâna yapılır.
--   5. Avatar listesi herkese açık değil; avatar adresi kendi klasörüne bağlı; depo boyut/tür sınırları.
--   6. Engelleme sorgusu yalnızca kendi ilişkilerini söyler.
--   7. Ücretsiz planda yapay zekâ kotalarına haftalık üst sınır (yeni seyahat açarak sıfırlanmaz).
--   8. Seyahat başına şehir sayısı ve plan başlığı uzunluğu sınırlı.

-- ---------------------------------------------------------------------------
-- 1. E-posta kanıtı ve seyahat davetleri
-- ---------------------------------------------------------------------------

-- Kullanıcının e-postasının kendisine ait olduğunun kanıtı: e-posta koduyla / bağlantıyla ya da
-- Apple/Google ile giriş. Şifreyle doğrudan kayıt (e-posta doğrulaması yoksa) kanıt sayılmaz.
create table public.email_proofs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  proved_at timestamptz not null default now()
);
alter table public.email_proofs enable row level security;
-- Politika yok: yalnızca aşağıdaki güvenli işlevler okur/yazar.

-- Mevcut doğrulanmış hesaplar kanıtlı sayılır (uygulamanın kaydı e-posta koduyla yapılıyordu).
insert into public.email_proofs (user_id, email)
select id, lower(email) from auth.users where email is not null and email_confirmed_at is not null
on conflict (user_id) do nothing;

create or replace function public.proved_email()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_amr jsonb := coalesce(auth.jwt() -> 'amr', '[]'::jsonb);
  v_proved boolean := false;
begin
  if v_uid is null then
    return null;
  end if;
  select lower(u.email) into v_email from auth.users u where u.id = v_uid;
  if v_email is null then
    return null;
  end if;
  if jsonb_typeof(v_amr) = 'array' then
    select coalesce(bool_or(a ->> 'method' in ('otp', 'magiclink', 'oauth', 'id_token', 'email/signup', 'email_change', 'invite', 'recovery')), false)
      into v_proved
      from jsonb_array_elements(v_amr) a;
  end if;
  if v_proved then
    insert into public.email_proofs (user_id, email, proved_at) values (v_uid, v_email, now())
      on conflict (user_id) do update set email = excluded.email, proved_at = now();
    return v_email;
  end if;
  -- Daha önce kanıtlanmışsa (ör. bugün şifreyle girdi) ve e-posta değişmediyse geçerli.
  return (select p.email from public.email_proofs p where p.user_id = v_uid and p.email = v_email);
end;
$$;
revoke all on function public.proved_email() from public, anon, authenticated;

alter table public.trip_invites add column accepted_by uuid references auth.users (id) on delete set null;
update public.trip_invites i set accepted_by = u.id
  from auth.users u
  where i.accepted_at is not null and lower(u.email) = i.email;

create or replace function public.create_trip_invite(p_trip_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
  v_own text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'only the trip owner can invite' using errcode = '42501';
  end if;
  if public.current_plan(null) not in ('pro_monthly', 'pro_yearly') then
    raise exception 'pro required' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  select lower(email) into v_own from auth.users where id = auth.uid();
  if v_own = v_email then
    raise exception 'cannot invite yourself' using errcode = '22023';
  end if;
  -- Aynı anda gönderilen davetler 10 sınırını aşamasın.
  perform pg_advisory_xact_lock(hashtextextended('trip_invites:' || p_trip_id::text, 0));
  if (select count(*) from public.trip_invites where trip_id = p_trip_id) >= 10
     and not exists (select 1 from public.trip_invites where trip_id = p_trip_id and email = v_email) then
    raise exception 'too many invites' using errcode = 'P0001';
  end if;

  insert into public.trip_invites (trip_id, email, invited_by)
  values (p_trip_id, v_email, auth.uid())
  on conflict (trip_id, email) do update
    set expires_at = now() + interval '30 days', invited_by = auth.uid()
  returning token into v_token;
  return v_token;
end;
$$;

-- Bekleyen davetler: yalnızca e-postasını kanıtlamış oturuma (aksi halde boş liste).
drop function if exists public.my_trip_invites();
create function public.my_trip_invites()
returns table (token text, trip_id uuid, trip_title text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := public.proved_email();
begin
  if v_email is null then
    return;
  end if;
  return query
    select i.token, i.trip_id, t.title, i.created_at
    from public.trip_invites i
    join public.trips t on t.id = i.trip_id
    where i.email = v_email and i.accepted_at is null and i.expires_at > now()
    order by i.created_at desc;
end;
$$;

create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.trip_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  v_email := public.proved_email();
  select * into v_invite from public.trip_invites where token = p_token and expires_at > now() for update;
  if v_invite.id is null or v_email is null or v_invite.email <> v_email
     or (v_invite.accepted_at is not null and v_invite.accepted_by is distinct from auth.uid()) then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), 'viewer')
  on conflict (trip_id, user_id) do nothing;
  update public.trip_invites set accepted_at = coalesce(accepted_at, now()), accepted_by = auth.uid() where id = v_invite.id;
  return v_invite.trip_id;
end;
$$;

-- Geri alma kabul eden hesabı (e-postası sonradan değişse bile) seyahatten çıkarır.
create or replace function public.revoke_trip_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.trip_invites%rowtype;
begin
  select * into v_invite from public.trip_invites where id = p_invite_id;
  if v_invite.id is null or not public.is_trip_owner(v_invite.trip_id) then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  delete from public.trip_members m
  where m.trip_id = v_invite.trip_id and m.role <> 'owner'
    and (m.user_id = v_invite.accepted_by
         or m.user_id in (select u.id from auth.users u where lower(u.email) = v_invite.email));
  delete from public.trip_invites where id = p_invite_id;
end;
$$;

revoke all on function public.create_trip_invite(uuid, text), public.my_trip_invites(),
  public.accept_trip_invite(text), public.revoke_trip_invite(uuid) from public, anon;
grant execute on function public.create_trip_invite(uuid, text), public.my_trip_invites(),
  public.accept_trip_invite(text), public.revoke_trip_invite(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Seyahate üye yalnızca davetle (ya da sahip olarak tetikleyiciyle) eklenir
-- ---------------------------------------------------------------------------
drop policy if exists "trip_members: sahibi üye ekler" on public.trip_members;
revoke insert on public.trip_members from authenticated, anon;

-- ---------------------------------------------------------------------------
-- 3. Davet ödülü: sunucu (generate-itinerary) plan ürettikten sonra çağırır
-- ---------------------------------------------------------------------------
drop trigger if exists usage_events_reward_referrer on public.usage_events;
drop function if exists public.reward_referrer_on_activity();

create or replace function public.reward_referrer(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals%rowtype;
begin
  select * into v_ref from public.referrals where referred_id = p_user and not referrer_rewarded for update;
  if not found then
    return false;
  end if;
  update public.referrals set referrer_rewarded = true where referred_id = p_user;
  if (select count(*) from public.referrals where referrer_id = v_ref.referrer_id and referrer_rewarded) <= 20 then
    insert into public.subscriptions (user_id, plan, status, store, product_id, original_transaction_id, starts_at, expires_at)
      values (v_ref.referrer_id, 'pro_monthly', 'active', 'promotional', 'yola_referral', 'referral:' || p_user || ':referrer', now(), now() + interval '7 days')
      on conflict (original_transaction_id) do nothing;
  end if;
  return true;
end;
$$;
revoke all on function public.reward_referrer(uuid) from public, anon, authenticated;
grant execute on function public.reward_referrer(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 4. Buluşma davetleri: yalnızca doğrulanmış halka açık mekâna
-- ---------------------------------------------------------------------------
-- "Şu an açık" aramasında Google'dan gelen işletmeler sunucu tarafından buraya yazılır.
create table public.verified_places (
  google_place_id text primary key check (google_place_id ~ '^[A-Za-z0-9_-]{10,255}$'),
  name text not null check (char_length(name) between 1 and 200),
  location extensions.geography(point, 4326) not null,
  verified_at timestamptz not null default now()
);
alter table public.verified_places enable row level security;
-- Politika yok: istemci yazamaz/okuyamaz; send_invite güvenli işlev olarak okur.

create or replace function public.send_invite(
  p_to_user uuid,
  p_google_place_id text,
  p_place_name text,
  p_place_lng double precision,
  p_place_lat double precision,
  p_meet_at timestamptz,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite uuid;
  v_quota record;
  v_place public.verified_places%rowtype;
begin
  if not exists (
    select 1 from public.nearby_travelers(50) n where n.user_id = p_to_user
  ) then
    raise exception 'user is not available for invites' using errcode = '42501';
  end if;

  if p_meet_at < now() then
    raise exception 'meeting time must be in the future' using errcode = '22023';
  end if;

  -- Mekân adı ve konumu istemciden değil, sunucunun doğruladığı kayıttan gelir (sahte "kafe" adıyla
  -- özel bir adrese çağırma engellenir). İstemcinin gönderdiği ad/konum yok sayılır.
  select * into v_place from public.verified_places where google_place_id = p_google_place_id and verified_at > now() - interval '30 days';
  if v_place.google_place_id is null then
    raise exception 'place is not available for invites' using errcode = '22023';
  end if;

  select * into v_quota from public.consume_quota('social_invite');
  if not v_quota.allowed then
    raise exception 'quota exceeded' using errcode = 'P0001', hint = 'upgrade';
  end if;

  insert into public.match_invites (from_user, to_user, google_place_id, place_name, place_location, meet_at, message)
  values (auth.uid(), p_to_user, v_place.google_place_id, v_place.name, v_place.location, p_meet_at, p_message)
  returning id into v_invite;

  return v_invite;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Depolama ve avatarlar
-- ---------------------------------------------------------------------------
-- Herkese açık kovada dosyalar adresle açılır; listeleme (kullanıcı kimliklerini sıralamak) kapatılır.
drop policy if exists "avatars: herkes okur" on storage.objects;

update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp']
  where id = 'documents';
update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
  where id = 'avatars';
update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg']
  where id = 'share-cards';

-- Avatar adresi yalnızca kendi klasörüne işaret edebilir (başka siteye takip pikseli konamaz).
alter table public.profiles drop constraint if exists profiles_avatar_url_storage;
alter table public.profiles add constraint profiles_avatar_url_storage
  check (avatar_url is null or avatar_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/[^/]+$')) not valid;

-- ---------------------------------------------------------------------------
-- 6. Engelleme sorgusu: başkalarının arasındaki engel bilgisi sızmaz
-- ---------------------------------------------------------------------------
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (auth.uid() is null or auth.uid() in (p_a, p_b))
    and exists (
      select 1 from public.user_blocks b
      where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
    );
$$;

-- ---------------------------------------------------------------------------
-- 7. Ücretsiz plan: yapay zekâ özelliklerine haftalık üst sınır
-- ---------------------------------------------------------------------------
-- Seyahat başına haklar yeni seyahat açarak sıfırlanmasın.
update public.plan_limits set per_week = 3 where plan = 'free' and feature in ('itinerary_generation', 'trip_report');
update public.plan_limits set per_week = 6 where plan = 'free' and feature in ('document_scan', 'replan');

-- ---------------------------------------------------------------------------
-- 8. Boyut sınırları
-- ---------------------------------------------------------------------------
create or replace function public.limit_trip_destinations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.trip_destinations where trip_id = new.trip_id) >= 15 then
    raise exception 'too many destinations' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.limit_trip_destinations() from public, anon, authenticated;
create trigger trip_destinations_limit before insert on public.trip_destinations
  for each row execute function public.limit_trip_destinations();

alter table public.plan_items add constraint plan_items_title_length check (char_length(title) <= 300) not valid;
