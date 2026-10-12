-- =============================================================================
-- Ödüllü reklam: ücretsiz kullanıcı günlük hakkı dolunca reklam izleyip +1 hak
-- kazanır. Hak, Google'ın imzalı sunucu doğrulaması (SSV) ad-reward fonksiyonuna
-- ulaşınca verilir; uygulama kendi başına hak ekleyemez. Kullanıcı başına günde
-- en fazla 3 ödül. Bonus sadece o günün günlük limitine eklenir.
-- =============================================================================

create table public.quota_bonuses (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  feature public.quota_feature not null,
  amount integer not null default 1 check (amount between 1 and 10),
  -- Google'ın işlem kimliği: aynı ödül iki kez sayılmaz.
  transaction_id text not null unique,
  created_at timestamptz not null default now()
);

create index quota_bonuses_lookup_idx on public.quota_bonuses (user_id, feature, created_at);

alter table public.quota_bonuses enable row level security;
create policy "quota_bonuses: kendi ödüllerini okur" on public.quota_bonuses
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.quota_bonuses from authenticated, anon;

/** Bugün bu özellik için kazanılan bonus. */
create or replace function public.bonus_today(p_user uuid, p_feature public.quota_feature)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(b.amount), 0)::integer from public.quota_bonuses b
  where b.user_id = p_user and b.feature = p_feature and b.created_at >= date_trunc('day', now());
$$;
revoke execute on function public.bonus_today(uuid, public.quota_feature) from public, anon, authenticated;

-- Ödülü kaydeder (sadece sunucu/servis rolü). Sonuç: 'granted', 'duplicate',
-- 'daily_limit' veya 'not_allowed'.
create or replace function public.grant_ad_reward(p_user uuid, p_feature public.quota_feature, p_transaction_id text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today integer;
begin
  if p_feature not in ('nearby_search', 'text_translation', 'travel_info', 'weather') then
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
revoke execute on function public.grant_ad_reward(uuid, public.quota_feature, text) from public, anon, authenticated;
grant execute on function public.grant_ad_reward(uuid, public.quota_feature, text) to service_role;

-- consume_quota: günlük limite bugünkü bonus eklenir (önceki sürümle aynı, sadece bu fark).
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

  insert into public.usage_events (user_id, trip_id, feature, amount) values (v_user, p_trip_id, p_feature, p_amount);

  v_remaining := least(
    case when v_limit.per_trip is null then null else v_limit.per_trip - v_used_trip - p_amount end,
    case when v_per_day is null then null else v_per_day - v_used_day - p_amount end
  );
  return query select true, v_plan, v_remaining;
end;
$$;

create or replace function public.quota_status(p_feature public.quota_feature, p_trip_id uuid default null)
returns table (plan public.subscription_plan, per_day integer, used_today integer, per_trip integer, used_trip integer)
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
      where u.user_id = auth.uid() and u.feature = p_feature and p_trip_id is not null and u.trip_id = p_trip_id)
  from p left join public.plan_limits l on l.plan = p.plan and l.feature = p_feature
  where auth.uid() is not null;
$$;
