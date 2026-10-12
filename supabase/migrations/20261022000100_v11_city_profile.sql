-- v1.1: vatandaşlık ve ek vizeler, yaşanan şehir (Şehrim), kayıtlı yerler,
-- gidilen yerler (şehir pasaportu), haftalık kotalar ve bağış (ücretsiz Pro) aboneliği.

-- -----------------------------------------------------------------------------
-- 1. Profil: ek pasaportlar, ek vizeler, yaşanan şehir
-- -----------------------------------------------------------------------------

-- Seçilebilen ek vize / oturum izni türleri. Uygulamadaki liste ile aynıdır.
create or replace function public.valid_extra_visas(p_keys text[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_keys), 0) <= 16 and coalesce(bool_and(k = any (array[
    'schengen_visa', 'us_visa', 'uk_visa', 'ca_visa', 'au_visa', 'nz_visa', 'jp_visa', 'ie_visa', 'kr_visa',
    'eu_residence', 'us_green_card', 'uk_residence', 'ca_pr', 'au_pr', 'gcc_residence', 'jp_residence'
  ])), true)
  from unnest(coalesce(p_keys, '{}')) k;
$$;

create or replace function public.valid_country_codes(p_codes text[], p_max integer)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(cardinality(p_codes), 0) <= p_max and coalesce(bool_and(c ~ '^[A-Z]{2}$'), true)
  from unnest(coalesce(p_codes, '{}')) c;
$$;

update public.profiles set passport_country = upper(passport_country) where passport_country is distinct from upper(passport_country);
update public.profiles set home_country = upper(home_country) where home_country is distinct from upper(home_country);

alter table public.profiles
  add column other_passports text[] not null default '{}' check (public.valid_country_codes(other_passports, 3)),
  add column extra_visas text[] not null default '{}' check (public.valid_extra_visas(extra_visas)),
  add column home_city text check (char_length(home_city) between 1 and 80),
  -- Gizlilik için şehir merkezi, ~1 km hassasiyetle (2 ondalık) tutulur.
  add column home_lat numeric(5, 2) check (home_lat between -90 and 90),
  add column home_lng numeric(6, 2) check (home_lng between -180 and 180),
  add constraint profiles_passport_format check (passport_country is null or passport_country ~ '^[A-Z]{2}$'),
  add constraint profiles_home_country_format check (home_country is null or home_country ~ '^[A-Z]{2}$');

grant update (other_passports, extra_visas, home_city, home_lat, home_lng) on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Haftalık kota (Şehrim ve Kaçamak planları haftada bir ücretsiz)
-- -----------------------------------------------------------------------------
alter table public.plan_limits add column per_week integer check (per_week >= 0);

insert into public.plan_limits (plan, feature, per_trip, per_day, per_week) values
  ('free', 'city_plan', null, null, 1),
  ('free', 'getaway', null, null, 1),
  ('free', 'spin', null, 1, null),
  ('trip_pass', 'city_plan', null, null, 1),
  ('trip_pass', 'getaway', null, null, 1),
  ('trip_pass', 'spin', null, 1, null),
  ('pro_monthly', 'city_plan', null, 30, null),
  ('pro_monthly', 'getaway', null, 20, null),
  ('pro_monthly', 'spin', null, null, null),
  ('pro_yearly', 'city_plan', null, 30, null),
  ('pro_yearly', 'getaway', null, 20, null),
  ('pro_yearly', 'spin', null, null, null)
on conflict (plan, feature) do nothing;

create or replace function public.consume_quota(p_feature public.quota_feature, p_trip_id uuid default null, p_amount integer default 1)
returns table (allowed boolean, plan public.subscription_plan, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_plan public.subscription_plan;
  v_limit public.plan_limits%rowtype;
  v_per_day integer;
  v_used_trip integer := 0;
  v_used_day integer := 0;
  v_used_week integer := 0;
  v_remaining integer;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_amount is null or p_amount < 1 or p_amount > 3600 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  if p_trip_id is not null and not public.is_trip_member(p_trip_id) then
    raise exception 'not a member of this trip' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_feature::text, 0));

  v_plan := public.current_plan(p_trip_id);
  select * into v_limit from public.plan_limits l where l.plan = v_plan and l.feature = p_feature;
  v_per_day := case when v_limit.per_day is null then null else v_limit.per_day + public.bonus_today(v_user, p_feature) end;

  if v_limit.per_trip is not null then
    select coalesce(sum(u.amount), 0) into v_used_trip from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.trip_id is not distinct from p_trip_id;
    if v_used_trip + p_amount > v_limit.per_trip then
      return query select false, v_plan, greatest(v_limit.per_trip - v_used_trip, 0);
      return;
    end if;
  end if;

  if v_per_day is not null then
    select coalesce(sum(u.amount), 0) into v_used_day from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.created_at >= date_trunc('day', now());
    if v_used_day + p_amount > v_per_day then
      return query select false, v_plan, greatest(v_per_day - v_used_day, 0);
      return;
    end if;
  end if;

  if v_limit.per_week is not null then
    select coalesce(sum(u.amount), 0) into v_used_week from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.created_at >= date_trunc('week', now());
    if v_used_week + p_amount > v_limit.per_week then
      return query select false, v_plan, greatest(v_limit.per_week - v_used_week, 0);
      return;
    end if;
  end if;

  insert into public.usage_events (user_id, trip_id, feature, amount) values (v_user, p_trip_id, p_feature, p_amount);

  v_remaining := least(
    case when v_limit.per_trip is null then null else v_limit.per_trip - v_used_trip - p_amount end,
    case when v_per_day is null then null else v_per_day - v_used_day - p_amount end,
    case when v_limit.per_week is null then null else v_limit.per_week - v_used_week - p_amount end
  );
  return query select true, v_plan, v_remaining;
end;
$$;

drop function public.quota_status(public.quota_feature, uuid);
create function public.quota_status(p_feature public.quota_feature, p_trip_id uuid default null)
returns table (plan public.subscription_plan, per_day integer, used_today integer, per_trip integer, used_trip integer, per_week integer, used_week integer)
language sql
stable
security definer
set search_path = ''
as $$
  with p as (select public.current_plan(p_trip_id) as plan)
  select
    p.plan,
    case when l.per_day is null then null else l.per_day + public.bonus_today(auth.uid(), p_feature) end,
    (select coalesce(sum(u.amount), 0)::integer from public.usage_events u
      where u.user_id = auth.uid() and u.feature = p_feature and u.created_at >= date_trunc('day', now())),
    l.per_trip,
    (select coalesce(sum(u.amount), 0)::integer from public.usage_events u
      where u.user_id = auth.uid() and u.feature = p_feature and p_trip_id is not null and u.trip_id = p_trip_id),
    l.per_week,
    (select coalesce(sum(u.amount), 0)::integer from public.usage_events u
      where u.user_id = auth.uid() and u.feature = p_feature and u.created_at >= date_trunc('week', now()))
  from p left join public.plan_limits l on l.plan = p.plan and l.feature = p_feature
  where auth.uid() is not null;
$$;
revoke execute on function public.quota_status(public.quota_feature, uuid) from public, anon;
grant execute on function public.quota_status(public.quota_feature, uuid) to authenticated;

-- Çark ödüllü reklamla da açılabilir (günde en fazla 3 ödül kuralı aynen geçerli).
create or replace function public.grant_ad_reward(p_user uuid, p_feature public.quota_feature, p_transaction_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today integer;
begin
  if p_feature not in ('nearby_search', 'text_translation', 'travel_info', 'weather', 'spin') then
    return 'not_allowed';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    return 'not_allowed';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || 'ad_reward', 0));
  if exists (select 1 from public.quota_bonuses b where b.transaction_id = p_transaction_id) then
    return 'duplicate';
  end if;
  select count(*) into v_today from public.quota_bonuses b where b.user_id = p_user and b.created_at >= date_trunc('day', now());
  if v_today >= 3 then
    return 'daily_limit';
  end if;
  insert into public.quota_bonuses (user_id, feature, transaction_id) values (p_user, p_feature, p_transaction_id);
  return 'granted';
end;
$$;

-- -----------------------------------------------------------------------------
-- 3. Kayıtlı yerler ("Gitmek istediklerim" ve Pro'da ek listeler)
-- -----------------------------------------------------------------------------
create table public.saved_places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_name text not null default 'want' check (char_length(list_name) between 1 and 40),
  google_place_id text not null check (char_length(google_place_id) between 1 and 300),
  name text not null check (char_length(name) between 1 and 200),
  category text check (char_length(category) <= 40),
  address text check (char_length(address) <= 300),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  maps_url text check (maps_url is null or (maps_url ~ '^https://' and char_length(maps_url) <= 500)),
  created_at timestamptz not null default now(),
  unique (user_id, list_name, google_place_id)
);

create index saved_places_user_idx on public.saved_places (user_id, list_name, created_at desc);

alter table public.saved_places enable row level security;

create policy "saved_places: kendi kayıtlarını okur" on public.saved_places
  for select to authenticated using (user_id = (select auth.uid()));
create policy "saved_places: kendi adına ekler" on public.saved_places
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "saved_places: kendi kaydını siler" on public.saved_places
  for delete to authenticated using (user_id = (select auth.uid()));

-- Ücretsiz planda tek liste ("want") ve en fazla 50 yer; Pro'da sınırsız liste.
create or replace function public.saved_places_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.current_plan() = 'free' then
    if new.list_name <> 'want' then
      raise exception 'pro_required' using errcode = 'P0001';
    end if;
    if (select count(*) from public.saved_places s where s.user_id = new.user_id) >= 50 then
      raise exception 'limit_reached' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger saved_places_guard before insert on public.saved_places
  for each row execute function public.saved_places_guard();

-- -----------------------------------------------------------------------------
-- 4. Şehir pasaportu: gidilen yerler, seri ve istatistik
-- -----------------------------------------------------------------------------
create table public.place_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  google_place_id text not null check (char_length(google_place_id) between 1 and 300),
  name text not null check (char_length(name) between 1 and 200),
  category text check (char_length(category) <= 40),
  city text check (char_length(city) <= 80),
  lat double precision check (lat between -90 and 90),
  lng double precision check (lng between -180 and 180),
  visited_on date not null default current_date check (visited_on <= current_date + 1),
  created_at timestamptz not null default now(),
  unique (user_id, google_place_id, visited_on)
);

create index place_visits_user_idx on public.place_visits (user_id, visited_on desc);

alter table public.place_visits enable row level security;

create policy "place_visits: kendi kayıtlarını okur" on public.place_visits
  for select to authenticated using (user_id = (select auth.uid()));
create policy "place_visits: kendi adına ekler" on public.place_visits
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "place_visits: kendi kaydını siler" on public.place_visits
  for delete to authenticated using (user_id = (select auth.uid()));

-- Şehir pasaportu özeti. Seri: art arda en az bir yer keşfedilen hafta sayısı
-- (bu hafta henüz yoksa geçen haftadan geriye sayılır).
create or replace function public.city_passport_stats()
returns table (places integer, visits integer, categories integer, this_month integer, week_streak integer)
language sql
stable
security definer
set search_path = ''
as $$
  with v as (select * from public.place_visits where user_id = auth.uid()),
  weeks as (select distinct date_trunc('week', visited_on)::date as w from v),
  anchor as (
    select case when exists (select 1 from weeks where w = date_trunc('week', current_date)::date)
      then date_trunc('week', current_date)::date
      else (date_trunc('week', current_date) - interval '7 days')::date end as a
  ),
  ranked as (select w, row_number() over (order by w desc) as rn from weeks, anchor where w <= anchor.a)
  select
    (select count(distinct google_place_id) from v)::integer,
    (select count(*) from v)::integer,
    (select count(distinct category) from v where category is not null)::integer,
    (select count(*) from v where visited_on >= date_trunc('month', current_date))::integer,
    (select count(*) from ranked, anchor where ranked.w = anchor.a - ((ranked.rn - 1) * 7)::integer)::integer
  where auth.uid() is not null;
$$;
revoke execute on function public.city_passport_stats() from public, anon;
grant execute on function public.city_passport_stats() to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Bağış (ücretsiz verilen) Pro: mağaza eşitlemesi bu kayıtları kapatmaz.
-- -----------------------------------------------------------------------------
-- Ürün kimliği 'yola_complimentary' olan 'promotional' kayıtlar yalnızca servis
-- rolüyle (grant-pro iş akışı) eklenir; RevenueCat eşitlemesi bunlara dokunmaz.
