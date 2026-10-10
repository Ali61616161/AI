-- =============================================================================
-- Yola: başlangıç şeması
--
-- Bölümler:
--   0. Eklentiler ve yardımcılar
--   1. Enum tipleri
--   2. Kullanıcılar: profiles, consents, emergency_contacts
--   3. Abonelik ve kullanım limitleri
--   4. Seyahatler: trips, trip_members, trip_destinations
--   5. Belgeler ve rezervasyonlar
--   6. Planlar: plan_versions, day_plans, plan_items
--   7. Seyahat sırasında: expenses, packing_items, location_shares
--   8. Seyahat sonrası: place_ratings, trip_reports
--   9. Sosyal mod: social_profiles, match_invites, messages, blocks, reports
--  10. Storage bucket'ları
--  11. Realtime
--
-- Kurallar:
--   - Her tabloda RLS açıktır. Politikası olmayan işlem (ör. abonelik yazma)
--     sadece service_role (Edge Functions / webhook) ile yapılabilir.
--   - SECURITY DEFINER fonksiyonlar search_path = '' ile tanımlanır ve
--     tüm nesneleri şemasıyla birlikte yazar.
--   - Kullanıcı silindiğinde (auth.users) tüm verisi cascade ile silinir (KVKK/GDPR).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 0. Eklentiler ve yardımcılar
-- -----------------------------------------------------------------------------
create extension if not exists postgis with schema extensions;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 1. Enum tipleri
-- -----------------------------------------------------------------------------
create type public.companion_type as enum ('solo', 'couple', 'family', 'friends');
create type public.budget_tier as enum ('low', 'mid', 'lux');
create type public.trip_status as enum ('draft', 'planned', 'active', 'completed', 'cancelled');
create type public.trip_member_role as enum ('owner', 'editor', 'viewer');
create type public.reservation_type as enum ('flight', 'hotel', 'train', 'bus', 'car_rental', 'event', 'other');
create type public.document_status as enum ('uploaded', 'processing', 'parsed', 'confirmed', 'failed');
create type public.plan_change_reason as enum ('initial', 'dates_changed', 'replan', 'crisis', 'manual_edit');
create type public.plan_item_kind as enum ('activity', 'meal', 'transport', 'accommodation', 'free_time', 'reservation');
create type public.plan_item_status as enum ('planned', 'visited', 'skipped');
create type public.expense_category as enum ('food', 'transport', 'accommodation', 'activity', 'shopping', 'other');
create type public.subscription_plan as enum ('free', 'trip_pass', 'pro_monthly', 'pro_yearly');
create type public.subscription_status as enum ('active', 'in_grace', 'cancelled', 'expired', 'refunded');
create type public.quota_feature as enum ('document_scan', 'itinerary_generation', 'replan', 'menu_scan', 'social_invite');
create type public.consent_type as enum ('terms', 'privacy', 'location', 'social_matching', 'id_verification', 'marketing');
create type public.invite_status as enum ('pending', 'accepted', 'declined', 'cancelled', 'expired');
create type public.report_reason as enum ('harassment', 'fake_profile', 'unsafe_behavior', 'spam', 'other');


-- -----------------------------------------------------------------------------
-- 2. Kullanıcılar
-- -----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 60),
  avatar_url text,
  bio text check (char_length(bio) <= 300),
  preferred_language text not null default 'en'
    check (preferred_language in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh')),
  home_currency char(3) not null default 'USD',
  home_country char(2),
  passport_country char(2),
  -- Sadece sosyal moddaki "yalnızca kadın gezginler" filtresi için kullanılır.
  gender text not null default 'undisclosed'
    check (gender in ('female', 'male', 'non_binary', 'undisclosed')),
  birth_year smallint check (birth_year between 1900 and 2100),
  interests text[] not null default '{}',
  default_companion public.companion_type,
  default_budget public.budget_tier,
  -- Kimlik doğrulaması sadece sunucu tarafından (service_role) işaretlenir.
  identity_verified_at timestamptz,
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles: kendi profilini okur" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles: kendi profilini günceller" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- identity_verified_at kullanıcı tarafından değiştirilemesin diye güncelleme
-- yetkisi sadece belirli sütunlara verilir.
revoke update on public.profiles from authenticated, anon;
grant update (
  display_name, avatar_url, bio, preferred_language, home_currency, home_country,
  passport_country, gender, birth_year, interests, default_companion, default_budget,
  onboarding_completed_at
) on public.profiles to authenticated;

-- Yeni kullanıcı kaydolduğunda profilini oluşturur.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lang text := new.raw_user_meta_data ->> 'language';
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    case when lang in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh') then lang else 'en' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- KVKK/GDPR açık rıza kayıtları. Sadece eklenir, değiştirilmez: her rıza veya
-- geri çekme yeni bir satırdır, en son satır geçerli durumu gösterir.
create table public.consents (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  consent public.consent_type not null,
  granted boolean not null,
  version text not null,
  created_at timestamptz not null default now()
);

create index consents_user_idx on public.consents (user_id, consent, created_at desc);

alter table public.consents enable row level security;

create policy "consents: kendi kayıtlarını okur" on public.consents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "consents: kendi adına ekler" on public.consents
  for insert to authenticated with check (user_id = (select auth.uid()));

create or replace function public.has_consent(p_consent public.consent_type)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select c.granted from public.consents c
    where c.user_id = auth.uid() and c.consent = p_consent
    order by c.created_at desc, c.id desc
    limit 1
  ), false);
$$;

create table public.emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  phone text not null check (char_length(phone) between 3 and 32),
  relation text,
  created_at timestamptz not null default now()
);

alter table public.emergency_contacts enable row level security;

create policy "emergency_contacts: sahibi yönetir" on public.emergency_contacts
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 3. Abonelik ve kullanım limitleri
-- -----------------------------------------------------------------------------

-- RevenueCat webhook'u (service_role) tarafından yazılır, kullanıcı sadece okur.
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan public.subscription_plan not null,
  status public.subscription_status not null,
  store text not null check (store in ('app_store', 'play_store', 'stripe', 'promotional')),
  product_id text not null,
  original_transaction_id text unique,
  -- Sadece trip_pass için: hangi seyahate ait olduğu.
  trip_id uuid,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- trip_id sadece Trip Pass için dolu olabilir. (Seyahat silinirse Trip Pass
  -- kaydı kalır ve trip_id boşalır, bu yüzden "trip_pass ise dolu olmalı" denmez.)
  constraint subscriptions_trip_only_for_pass check (plan = 'trip_pass' or trip_id is null)
);

create index subscriptions_user_idx on public.subscriptions (user_id, status);

create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute function public.set_updated_at();

alter table public.subscriptions enable row level security;

create policy "subscriptions: kendi aboneliğini okur" on public.subscriptions
  for select to authenticated using (user_id = (select auth.uid()));

-- Plan başına limitler. NULL = sınırsız. Limitler kodda değil burada durur,
-- böylece uygulama güncellemesi gerekmeden değiştirilebilir.
create table public.plan_limits (
  plan public.subscription_plan not null,
  feature public.quota_feature not null,
  per_trip integer check (per_trip >= 0),
  per_day integer check (per_day >= 0),
  primary key (plan, feature)
);

alter table public.plan_limits enable row level security;

create policy "plan_limits: herkes okur" on public.plan_limits
  for select to authenticated, anon using (true);

insert into public.plan_limits (plan, feature, per_trip, per_day) values
  ('free', 'document_scan', 2, null),
  ('free', 'itinerary_generation', 2, null),
  ('free', 'replan', 3, null),
  ('free', 'menu_scan', null, 3),
  ('free', 'social_invite', null, 1),
  ('trip_pass', 'document_scan', null, null),
  ('trip_pass', 'itinerary_generation', null, null),
  ('trip_pass', 'replan', null, null),
  ('trip_pass', 'menu_scan', null, null),
  ('trip_pass', 'social_invite', null, null),
  ('pro_monthly', 'document_scan', null, null),
  ('pro_monthly', 'itinerary_generation', null, null),
  ('pro_monthly', 'replan', null, null),
  ('pro_monthly', 'menu_scan', null, null),
  ('pro_monthly', 'social_invite', null, null),
  ('pro_yearly', 'document_scan', null, null),
  ('pro_yearly', 'itinerary_generation', null, null),
  ('pro_yearly', 'replan', null, null),
  ('pro_yearly', 'menu_scan', null, null),
  ('pro_yearly', 'social_invite', null, null);

create table public.usage_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid,
  feature public.quota_feature not null,
  created_at timestamptz not null default now()
);

create index usage_events_lookup_idx on public.usage_events (user_id, feature, trip_id, created_at);

alter table public.usage_events enable row level security;

create policy "usage_events: kendi kullanımını okur" on public.usage_events
  for select to authenticated using (user_id = (select auth.uid()));

-- Kullanıcının (isteğe bağlı olarak belirli bir seyahat için) geçerli planı.
-- Pro abonelik her şeyi kapsar; Trip Pass sadece ait olduğu seyahati kapsar.
create or replace function public.current_plan(p_trip_id uuid default null)
returns public.subscription_plan
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select s.plan from public.subscriptions s
      where s.user_id = auth.uid()
        and s.plan in ('pro_monthly', 'pro_yearly')
        and s.status in ('active', 'in_grace')
        and (s.expires_at is null or s.expires_at > now())
      order by s.expires_at desc nulls first
      limit 1),
    (select s.plan from public.subscriptions s
      where p_trip_id is not null
        and s.user_id = auth.uid()
        and s.plan = 'trip_pass'
        and s.trip_id = p_trip_id
        and s.status in ('active', 'in_grace')
        and (s.expires_at is null or s.expires_at > now())
      limit 1),
    'free'::public.subscription_plan
  );
$$;

-- Bir özelliği kullanmadan önce Edge Function'lar tarafından çağrılır.
-- Limit aşılmadıysa kullanımı kaydeder ve allowed = true döner.
create or replace function public.consume_quota(p_feature public.quota_feature, p_trip_id uuid default null)
returns table (allowed boolean, plan public.subscription_plan, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.subscription_plan;
  v_limit public.plan_limits%rowtype;
  v_used_trip integer := 0;
  v_used_day integer := 0;
  v_remaining integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;

  if p_trip_id is not null and not public.is_trip_member(p_trip_id) then
    raise exception 'not a member of this trip' using errcode = '42501';
  end if;

  -- Aynı kullanıcının eşzamanlı istekleri limiti aşamasın.
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_feature::text, 0));

  v_plan := public.current_plan(p_trip_id);
  select * into v_limit from public.plan_limits l where l.plan = v_plan and l.feature = p_feature;

  if v_limit.per_trip is not null then
    select count(*) into v_used_trip from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.trip_id is not distinct from p_trip_id;
    if v_used_trip >= v_limit.per_trip then
      return query select false, v_plan, 0;
      return;
    end if;
  end if;

  if v_limit.per_day is not null then
    select count(*) into v_used_day from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.created_at >= date_trunc('day', now());
    if v_used_day >= v_limit.per_day then
      return query select false, v_plan, 0;
      return;
    end if;
  end if;

  insert into public.usage_events (user_id, trip_id, feature) values (v_user, p_trip_id, p_feature);

  v_remaining := least(
    case when v_limit.per_trip is null then null else v_limit.per_trip - v_used_trip - 1 end,
    case when v_limit.per_day is null then null else v_limit.per_day - v_used_day - 1 end
  );
  return query select true, v_plan, v_remaining;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. Seyahatler
-- -----------------------------------------------------------------------------
create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  status public.trip_status not null default 'draft',
  start_date date,
  end_date date,
  companion_type public.companion_type not null default 'solo',
  budget_tier public.budget_tier not null default 'mid',
  interests text[] not null default '{}',
  adults smallint not null default 1 check (adults between 1 and 20),
  children smallint not null default 0 check (children between 0 and 20),
  budget_amount numeric(12, 2) check (budget_amount >= 0),
  budget_currency char(3),
  cover_image_url text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or start_date is null or end_date >= start_date)
);

create index trips_owner_idx on public.trips (owner_id, start_date desc);

create trigger trips_updated_at before update on public.trips
  for each row execute function public.set_updated_at();

alter table public.subscriptions
  add constraint subscriptions_trip_fk foreign key (trip_id) references public.trips (id) on delete set null;

alter table public.usage_events
  add constraint usage_events_trip_fk foreign key (trip_id) references public.trips (id) on delete set null;

-- Seyahati paylaşan kişiler (çiftler, aileler, arkadaş grupları).
create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.trip_member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

alter table public.trip_members enable row level security;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_edit_trip(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role in ('owner', 'editor')
  );
$$;

create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members m
    where m.trip_id = p_trip_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- Seyahati oluşturan kişi otomatik olarak sahibi (owner) olur.
create or replace function public.add_trip_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, role) values (new.id, new.owner_id, 'owner');
  return new;
end;
$$;

create trigger trips_add_owner after insert on public.trips
  for each row execute function public.add_trip_owner();

alter table public.trips enable row level security;

create policy "trips: üyeler okur" on public.trips
  for select to authenticated using (public.is_trip_member(id));
create policy "trips: kendi adına oluşturur" on public.trips
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "trips: düzenleyiciler günceller" on public.trips
  for update to authenticated using (public.can_edit_trip(id)) with check (public.can_edit_trip(id));
create policy "trips: sahibi siler" on public.trips
  for delete to authenticated using (public.is_trip_owner(id));

create policy "trip_members: üyeler listeyi görür" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "trip_members: sahibi üye ekler" on public.trip_members
  for insert to authenticated with check (public.is_trip_owner(trip_id) and role <> 'owner');
create policy "trip_members: sahibi rol değiştirir" on public.trip_members
  for update to authenticated using (public.is_trip_owner(trip_id)) with check (role <> 'owner');
create policy "trip_members: sahibi çıkarır, üye ayrılır" on public.trip_members
  for delete to authenticated
  using (role <> 'owner' and (public.is_trip_owner(trip_id) or user_id = (select auth.uid())));

create table public.trip_destinations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  position smallint not null default 0,
  city text not null,
  country_code char(2),
  google_place_id text,
  location extensions.geography(point, 4326),
  arrive_on date,
  depart_on date,
  created_at timestamptz not null default now(),
  check (depart_on is null or arrive_on is null or depart_on >= arrive_on)
);

create index trip_destinations_trip_idx on public.trip_destinations (trip_id, position);

alter table public.trip_destinations enable row level security;

create policy "trip_destinations: üyeler okur" on public.trip_destinations
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "trip_destinations: düzenleyiciler yönetir" on public.trip_destinations
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));


-- -----------------------------------------------------------------------------
-- 5. Belgeler ve rezervasyonlar
-- -----------------------------------------------------------------------------

-- Yüklenen bilet/otel belgeleri. Dosyanın kendisi storage'da "documents"
-- bucket'ında <user_id>/<dosya> yolunda durur; AI'ın çıkardığı veri parsed_data'dadır.
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  storage_path text not null unique,
  mime_type text not null,
  status public.document_status not null default 'uploaded',
  detected_type public.reservation_type,
  -- AI çıktısı: { "type": "flight", "segments": [...], ... }
  parsed_data jsonb,
  -- Alan bazında güven skorları (0-1): arayüz düşük güvenli alanları sarı gösterir.
  confidence jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_user_idx on public.documents (user_id, created_at desc);

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

alter table public.documents enable row level security;

create policy "documents: sahibi yönetir" on public.documents
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and (trip_id is null or public.can_edit_trip(trip_id)));

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  document_id uuid references public.documents (id) on delete set null,
  type public.reservation_type not null,
  is_cancelled boolean not null default false,
  title text not null,
  provider_name text,
  -- PNR, otel onay numarası vb.
  reference_code text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  -- Yerel saatleri doğru göstermek için IANA saat dilimleri (ör. Europe/Rome).
  start_timezone text,
  end_timezone text,
  origin_name text,
  origin_code text,
  destination_name text,
  destination_code text,
  address text,
  google_place_id text,
  location extensions.geography(point, 4326),
  -- Türe özel alanlar: koltuk, bagaj, kahvaltı dahil mi, peron, QR kod vb.
  details jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at is null or ends_at >= starts_at)
);

create index reservations_trip_idx on public.reservations (trip_id, starts_at);

create trigger reservations_updated_at before update on public.reservations
  for each row execute function public.set_updated_at();

alter table public.reservations enable row level security;

create policy "reservations: üyeler okur" on public.reservations
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "reservations: düzenleyiciler yönetir" on public.reservations
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));


-- -----------------------------------------------------------------------------
-- 6. Planlar
--
-- Her yeniden planlama (tarih değişikliği, "Planı Değiştir", manuel düzenleme)
-- yeni bir plan_version oluşturur. Bir seyahatin aynı anda tek aktif sürümü olur;
-- kullanıcı eski sürümleri karşılaştırıp geri dönebilir.
-- -----------------------------------------------------------------------------
create table public.plan_versions (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  version integer not null check (version > 0),
  reason public.plan_change_reason not null,
  -- "Yağmur başladı, kapalı yer bul" gibi kullanıcı isteği.
  user_prompt text,
  -- AI'ın değişiklik özeti: "2 gün kısaldı, Uffizi ve Boboli korundu..."
  summary text,
  is_active boolean not null default false,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (trip_id, version)
);

create unique index plan_versions_one_active on public.plan_versions (trip_id) where is_active;

alter table public.plan_versions enable row level security;

create policy "plan_versions: üyeler okur" on public.plan_versions
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "plan_versions: düzenleyiciler ekler" on public.plan_versions
  for insert to authenticated with check (public.can_edit_trip(trip_id) and not is_active);
create policy "plan_versions: düzenleyiciler siler" on public.plan_versions
  for delete to authenticated using (public.can_edit_trip(trip_id) and not is_active);

-- Bir sürümü aktif yapar, diğerlerini pasifleştirir (tek işlemde).
create or replace function public.activate_plan_version(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trip uuid;
begin
  select trip_id into v_trip from public.plan_versions where id = p_version_id;
  if v_trip is null or not public.can_edit_trip(v_trip) then
    raise exception 'plan version not found or not editable' using errcode = '42501';
  end if;
  update public.plan_versions set is_active = false where trip_id = v_trip and is_active and id <> p_version_id;
  update public.plan_versions set is_active = true where id = p_version_id;
end;
$$;

create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  plan_version_id uuid not null references public.plan_versions (id) on delete cascade,
  -- RLS için tutulur; tetikleyici tarafından plan_version'dan doldurulur.
  trip_id uuid not null references public.trips (id) on delete cascade,
  date date not null,
  city text,
  title text,
  notes text,
  -- Planlandığı andaki hava tahmini.
  weather jsonb,
  created_at timestamptz not null default now(),
  unique (plan_version_id, date)
);

create index day_plans_trip_idx on public.day_plans (trip_id, date);

create table public.plan_items (
  id uuid primary key default gen_random_uuid(),
  day_plan_id uuid not null references public.day_plans (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  position smallint not null default 0,
  kind public.plan_item_kind not null,
  title text not null,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  google_place_id text,
  place_name text,
  location extensions.geography(point, 4326),
  address text,
  estimated_cost numeric(12, 2) check (estimated_cost >= 0),
  cost_currency char(3),
  -- Seyahat kısaltılırken hangi durakların korunacağını belirler (5 = vazgeçilmez).
  priority smallint not null default 3 check (priority between 1 and 5),
  -- Satın alınmış bilet veya otel gibi, yeniden planlamada yerinden oynatılamayan durak.
  is_locked boolean not null default false,
  reservation_id uuid references public.reservations (id) on delete set null,
  booking_url text,
  affiliate_partner text,
  status public.plan_item_status not null default 'planned',
  visited_at timestamptz,
  created_at timestamptz not null default now(),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index plan_items_day_idx on public.plan_items (day_plan_id, position);
create index plan_items_trip_idx on public.plan_items (trip_id);

-- Alt tablolardaki trip_id'nin üst kayıtla tutarlı olmasını sağlar; böylece
-- kullanıcı başkasının planına kendi trip_id'siyle satır ekleyemez.
create or replace function public.day_plans_set_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select trip_id into new.trip_id from public.plan_versions where id = new.plan_version_id;
  return new;
end;
$$;

create trigger day_plans_set_trip before insert or update of plan_version_id, trip_id on public.day_plans
  for each row execute function public.day_plans_set_trip();

create or replace function public.plan_items_set_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select trip_id into new.trip_id from public.day_plans where id = new.day_plan_id;
  return new;
end;
$$;

create trigger plan_items_set_trip before insert or update of day_plan_id, trip_id on public.plan_items
  for each row execute function public.plan_items_set_trip();

alter table public.day_plans enable row level security;
alter table public.plan_items enable row level security;

create policy "day_plans: üyeler okur" on public.day_plans
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "day_plans: düzenleyiciler yönetir" on public.day_plans
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy "plan_items: üyeler okur" on public.plan_items
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "plan_items: düzenleyiciler yönetir" on public.plan_items
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));


-- -----------------------------------------------------------------------------
-- 7. Seyahat sırasında
-- -----------------------------------------------------------------------------
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  paid_by uuid default auth.uid() references auth.users (id) on delete set null,
  amount numeric(12, 2) not null check (amount > 0),
  currency char(3) not null,
  -- Bütçe para birimine çevrilmiş tutar (harcama anındaki kurla).
  amount_in_budget_currency numeric(12, 2),
  category public.expense_category not null default 'other',
  description text,
  plan_item_id uuid references public.plan_items (id) on delete set null,
  spent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index expenses_trip_idx on public.expenses (trip_id, spent_at);

-- Hesap bölüşme: yol arkadaşı uygulamayı kullanmıyor olabilir, bu yüzden isimle tutulur.
create table public.expense_shares (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  participant_name text not null,
  user_id uuid references auth.users (id) on delete set null,
  share_amount numeric(12, 2) not null check (share_amount >= 0),
  is_settled boolean not null default false
);

alter table public.expenses enable row level security;
alter table public.expense_shares enable row level security;

create policy "expenses: üyeler okur" on public.expenses
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "expenses: düzenleyiciler yönetir" on public.expenses
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

create policy "expense_shares: üyeler okur" on public.expense_shares
  for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_trip_member(e.trip_id)));
create policy "expense_shares: düzenleyiciler yönetir" on public.expense_shares
  for all to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.can_edit_trip(e.trip_id)))
  with check (exists (select 1 from public.expenses e where e.id = expense_id and public.can_edit_trip(e.trip_id)));

create table public.packing_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  label text not null,
  category text,
  quantity smallint not null default 1 check (quantity > 0),
  is_packed boolean not null default false,
  source text not null default 'manual' check (source in ('ai', 'manual')),
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create index packing_items_trip_idx on public.packing_items (trip_id, position);

alter table public.packing_items enable row level security;

create policy "packing_items: üyeler okur" on public.packing_items
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "packing_items: düzenleyiciler yönetir" on public.packing_items
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));

-- Güvenlik merkezi: canlı konumu güvenilen kişilerle paylaşma. Bağlantıyı açan
-- kişi uygulamayı kullanmıyor olabilir; token ile bir Edge Function üzerinden okunur.
create table public.location_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid references public.trips (id) on delete set null,
  token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null,
  last_location extensions.geography(point, 4326),
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.location_shares enable row level security;

create policy "location_shares: sahibi yönetir" on public.location_shares
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));


-- -----------------------------------------------------------------------------
-- 8. Seyahat sonrası
-- -----------------------------------------------------------------------------
create table public.place_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  plan_item_id uuid references public.plan_items (id) on delete set null,
  google_place_id text,
  place_name text not null,
  rating smallint not null check (rating between 1 and 5),
  note text check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, plan_item_id)
);

create index place_ratings_trip_idx on public.place_ratings (trip_id);
create index place_ratings_user_idx on public.place_ratings (user_id, created_at desc);

alter table public.place_ratings enable row level security;

create policy "place_ratings: üyeler okur" on public.place_ratings
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "place_ratings: kendi puanını yönetir" on public.place_ratings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

-- Seyahat bitince oluşturulan rapor: istatistikler, genel puan, AI çıkarımları
-- ve paylaşılabilir hikaye kartı.
create table public.trip_reports (
  trip_id uuid primary key references public.trips (id) on delete cascade,
  -- { "cities": 3, "places_visited": 17, "walked_km": 42.5, "spent": 812.40, "budget": 900, ... }
  stats jsonb not null default '{}',
  overall_rating smallint check (overall_rating between 1 and 5),
  route_rating smallint check (route_rating between 1 and 5),
  feedback text check (char_length(feedback) <= 1000),
  -- Kişiselleştirmeye geri beslenen çıkarımlar: { "liked": ["outdoor"], "disliked": ["museums"] }
  ai_insights jsonb,
  share_card_path text,
  generated_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trip_reports_updated_at before update on public.trip_reports
  for each row execute function public.set_updated_at();

alter table public.trip_reports enable row level security;

create policy "trip_reports: üyeler okur" on public.trip_reports
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "trip_reports: düzenleyiciler yönetir" on public.trip_reports
  for all to authenticated using (public.can_edit_trip(trip_id)) with check (public.can_edit_trip(trip_id));


-- -----------------------------------------------------------------------------
-- 9. Sosyal mod
--
-- Gizlilik ilkeleri:
--   - Konum ~1 km'ye yuvarlanarak saklanır; tam konum hiçbir zaman tutulmaz.
--   - Diğer kullanıcılar tabloya doğrudan erişemez, sadece nearby_travelers()
--     fonksiyonunun döndürdüğü sınırlı alanları görür.
--   - Davetler sadece Google Places'ta kayıtlı halka açık bir mekan için gönderilebilir.
--   - Engellenen kullanıcılar birbirini hiçbir yerde görmez.
-- -----------------------------------------------------------------------------
create table public.social_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_visible boolean not null default false,
  trip_id uuid references public.trips (id) on delete set null,
  city text,
  country_code char(2),
  approx_location extensions.geography(point, 4326),
  available_from date,
  available_until date,
  -- 'coffee', 'museum', 'walk', 'food', 'nightlife', 'nature' ...
  looking_for text[] not null default '{}',
  -- Açıksa sadece kadın kullanıcılar birbirini görür.
  women_only boolean not null default false,
  updated_at timestamptz not null default now(),
  check (available_until is null or available_from is null or available_until >= available_from)
);

create index social_profiles_location_idx on public.social_profiles using gist (approx_location) where is_visible;

-- Konumu ~1,1 km'lik ızgaraya yuvarlar.
create or replace function public.social_profiles_fuzz_location()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.approx_location is not null then
    new.approx_location := extensions.st_snaptogrid(new.approx_location::extensions.geometry, 0.01)::extensions.geography;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger social_profiles_fuzz before insert or update on public.social_profiles
  for each row execute function public.social_profiles_fuzz_location();

alter table public.social_profiles enable row level security;

create policy "social_profiles: kendi kaydını okur" on public.social_profiles
  for select to authenticated using (user_id = (select auth.uid()));
create policy "social_profiles: rıza vermişse oluşturur" on public.social_profiles
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.has_consent('social_matching')
    and public.has_consent('location')
  );
create policy "social_profiles: rıza vermişse günceller" on public.social_profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (not is_visible or (public.has_consent('social_matching') and public.has_consent('location')))
  );
create policy "social_profiles: kendi kaydını siler" on public.social_profiles
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.user_blocks (
  blocker_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  blocked_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

create policy "user_blocks: kendi engellerini yönetir" on public.user_blocks
  for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

create table public.match_invites (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references auth.users (id) on delete cascade,
  to_user uuid not null references auth.users (id) on delete cascade,
  google_place_id text not null,
  place_name text not null,
  place_location extensions.geography(point, 4326),
  meet_at timestamptz not null,
  message text check (char_length(message) <= 280),
  status public.invite_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  check (from_user <> to_user)
);

create index match_invites_to_idx on public.match_invites (to_user, status, created_at desc);
create index match_invites_from_idx on public.match_invites (from_user, created_at desc);

alter table public.match_invites enable row level security;

-- Davetler sadece aşağıdaki fonksiyonlarla oluşturulur ve yanıtlanır.
create policy "match_invites: taraflar okur" on public.match_invites
  for select to authenticated
  using ((select auth.uid()) in (from_user, to_user) and not public.is_blocked_between(from_user, to_user));

create table public.messages (
  id bigint generated always as identity primary key,
  invite_id uuid not null references public.match_invites (id) on delete cascade,
  sender_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_invite_idx on public.messages (invite_id, created_at);

alter table public.messages enable row level security;

create or replace function public.is_invite_participant(p_invite_id uuid, p_require_accepted boolean)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.match_invites i
    where i.id = p_invite_id
      and auth.uid() in (i.from_user, i.to_user)
      and (not p_require_accepted or i.status = 'accepted')
      and not public.is_blocked_between(i.from_user, i.to_user)
  );
$$;

create policy "messages: taraflar okur" on public.messages
  for select to authenticated using (public.is_invite_participant(invite_id, false));
create policy "messages: kabul edilmiş davette yazar" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_invite_participant(invite_id, true));

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  reported_id uuid not null references auth.users (id) on delete cascade,
  invite_id uuid references public.match_invites (id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved')),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.user_reports enable row level security;

create policy "user_reports: kendi şikayetini okur" on public.user_reports
  for select to authenticated using (reporter_id = (select auth.uid()));
create policy "user_reports: şikayet oluşturur" on public.user_reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

-- Yakındaki görünür gezginleri listeler. Sadece arayan kişi de görünürse çalışır
-- (görmek için görünmek gerekir). Mesafe 0,5 km'ye yuvarlanır.
create or replace function public.nearby_travelers(p_radius_km numeric default 5)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  interests text[],
  looking_for text[],
  is_verified boolean,
  city text,
  available_until date,
  distance_km numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_me public.social_profiles%rowtype;
  v_my_gender text;
begin
  select * into v_me from public.social_profiles sp where sp.user_id = auth.uid() and sp.is_visible;
  if not found or v_me.approx_location is null then
    return;
  end if;
  select p.gender into v_my_gender from public.profiles p where p.id = auth.uid();

  return query
  select
    sp.user_id,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.interests,
    sp.looking_for,
    p.identity_verified_at is not null,
    sp.city,
    sp.available_until,
    round(extensions.st_distance(sp.approx_location, v_me.approx_location)::numeric / 500) * 0.5
  from public.social_profiles sp
  join public.profiles p on p.id = sp.user_id
  where sp.is_visible
    and sp.user_id <> auth.uid()
    and extensions.st_dwithin(sp.approx_location, v_me.approx_location, least(p_radius_km, 50) * 1000)
    and (sp.available_until is null or sp.available_until >= current_date)
    and not public.is_blocked_between(sp.user_id, auth.uid())
    and (
      (not sp.women_only and not v_me.women_only)
      or (p.gender = 'female' and v_my_gender = 'female')
    )
  order by extensions.st_distance(sp.approx_location, v_me.approx_location)
  limit 50;
end;
$$;

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
begin
  if not exists (
    select 1 from public.nearby_travelers(50) n where n.user_id = p_to_user
  ) then
    raise exception 'user is not available for invites' using errcode = '42501';
  end if;

  if p_meet_at < now() then
    raise exception 'meeting time must be in the future' using errcode = '22023';
  end if;

  select * into v_quota from public.consume_quota('social_invite');
  if not v_quota.allowed then
    raise exception 'quota exceeded' using errcode = 'P0001', hint = 'upgrade';
  end if;

  insert into public.match_invites (from_user, to_user, google_place_id, place_name, place_location, meet_at, message)
  values (
    auth.uid(), p_to_user, p_google_place_id, p_place_name,
    extensions.st_setsrid(extensions.st_makepoint(p_place_lng, p_place_lat), 4326)::extensions.geography,
    p_meet_at, p_message
  )
  returning id into v_invite;

  return v_invite;
end;
$$;

create or replace function public.respond_invite(p_invite_id uuid, p_status public.invite_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.match_invites%rowtype;
begin
  select * into v_invite from public.match_invites where id = p_invite_id for update;
  if not found or v_invite.status <> 'pending' then
    raise exception 'invite not found or already answered' using errcode = '42501';
  end if;

  if p_status in ('accepted', 'declined') and v_invite.to_user = auth.uid() then
    null;
  elsif p_status = 'cancelled' and v_invite.from_user = auth.uid() then
    null;
  else
    raise exception 'not allowed' using errcode = '42501';
  end if;

  update public.match_invites set status = p_status, responded_at = now() where id = p_invite_id;
end;
$$;


-- -----------------------------------------------------------------------------
-- Fonksiyon yetkileri: varsayılan olarak herkes (PUBLIC) çalıştırabilir;
-- sadece giriş yapmış kullanıcılara açıyoruz.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.has_consent(public.consent_type),
  public.current_plan(uuid),
  public.consume_quota(public.quota_feature, uuid),
  public.is_trip_member(uuid),
  public.can_edit_trip(uuid),
  public.is_trip_owner(uuid),
  public.activate_plan_version(uuid),
  public.is_blocked_between(uuid, uuid),
  public.is_invite_participant(uuid, boolean),
  public.nearby_travelers(numeric),
  public.send_invite(uuid, text, text, double precision, double precision, timestamptz, text),
  public.respond_invite(uuid, public.invite_status)
from public, anon;

grant execute on function
  public.has_consent(public.consent_type),
  public.current_plan(uuid),
  public.consume_quota(public.quota_feature, uuid),
  public.is_trip_member(uuid),
  public.can_edit_trip(uuid),
  public.is_trip_owner(uuid),
  public.activate_plan_version(uuid),
  public.is_blocked_between(uuid, uuid),
  public.is_invite_participant(uuid, boolean),
  public.nearby_travelers(numeric),
  public.send_invite(uuid, text, text, double precision, double precision, timestamptz, text),
  public.respond_invite(uuid, public.invite_status)
to authenticated;

-- Tetikleyici fonksiyonları doğrudan çağrılamasın.
revoke execute on function
  public.handle_new_user(),
  public.add_trip_owner(),
  public.day_plans_set_trip(),
  public.plan_items_set_trip()
from public, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 10. Storage bucket'ları
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('avatars', 'avatars', true),
  ('share-cards', 'share-cards', false)
on conflict (id) do nothing;

-- Dosyalar <user_id>/... yolunda tutulur; herkes sadece kendi klasörüne erişir.
create policy "documents: kendi klasörü" on storage.objects
  for all to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: herkes okur" on storage.objects
  for select to authenticated, anon using (bucket_id = 'avatars');
create policy "avatars: kendi klasörüne yazar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: kendi dosyasını günceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "avatars: kendi dosyasını siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "share-cards: kendi klasörü" on storage.objects
  for all to authenticated
  using (bucket_id = 'share-cards' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'share-cards' and (storage.foldername(name))[1] = (select auth.uid())::text);


-- -----------------------------------------------------------------------------
-- 11. Realtime: sohbet ve davetler anlık güncellensin.
-- -----------------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.match_invites;
