-- =============================================================================
-- Çeviri merkezi: metin çevirisi (ücretsiz 20/gün), sesli konuşma çevirisi
-- (ücretsiz 5 dk/gün = 300 saniye) ve kamera ile menü/tabela (menu_scan, 3/gün).
-- Konuşma çevirisi saniyeyle ölçüldüğü için kullanım kaydına miktar eklenir.
-- =============================================================================

alter table public.usage_events
  add column amount integer not null default 1 check (amount between 1 and 3600);

insert into public.plan_limits (plan, feature, per_trip, per_day) values
  ('free', 'text_translation', null, 20),
  ('free', 'voice_translation', null, 300),
  ('trip_pass', 'text_translation', null, null),
  ('trip_pass', 'voice_translation', null, null),
  ('pro_monthly', 'text_translation', null, null),
  ('pro_monthly', 'voice_translation', null, null),
  ('pro_yearly', 'text_translation', null, null),
  ('pro_yearly', 'voice_translation', null, null)
on conflict (plan, feature) do nothing;

-- consume_quota artık bir seferde birden fazla birim (ör. saniye) tüketebilir.
-- Limitler kullanılan miktarların toplamıyla karşılaştırılır.
drop function public.consume_quota(public.quota_feature, uuid);

create function public.consume_quota(p_feature public.quota_feature, p_trip_id uuid default null, p_amount integer default 1)
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
  if p_amount is null or p_amount < 1 or p_amount > 3600 then
    raise exception 'invalid amount' using errcode = '22023';
  end if;

  if p_trip_id is not null and not public.is_trip_member(p_trip_id) then
    raise exception 'not a member of this trip' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || p_feature::text, 0));

  v_plan := public.current_plan(p_trip_id);
  select * into v_limit from public.plan_limits l where l.plan = v_plan and l.feature = p_feature;

  if v_limit.per_trip is not null then
    select coalesce(sum(u.amount), 0) into v_used_trip from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.trip_id is not distinct from p_trip_id;
    if v_used_trip + p_amount > v_limit.per_trip then
      return query select false, v_plan, greatest(v_limit.per_trip - v_used_trip, 0);
      return;
    end if;
  end if;

  if v_limit.per_day is not null then
    select coalesce(sum(u.amount), 0) into v_used_day from public.usage_events u
      where u.user_id = v_user and u.feature = p_feature
        and u.created_at >= date_trunc('day', now());
    if v_used_day + p_amount > v_limit.per_day then
      return query select false, v_plan, greatest(v_limit.per_day - v_used_day, 0);
      return;
    end if;
  end if;

  insert into public.usage_events (user_id, trip_id, feature, amount) values (v_user, p_trip_id, p_feature, p_amount);

  v_remaining := least(
    case when v_limit.per_trip is null then null else v_limit.per_trip - v_used_trip - p_amount end,
    case when v_limit.per_day is null then null else v_limit.per_day - v_used_day - p_amount end
  );
  return query select true, v_plan, v_remaining;
end;
$$;

revoke execute on function public.consume_quota(public.quota_feature, uuid, integer) from public, anon;
grant execute on function public.consume_quota(public.quota_feature, uuid, integer) to authenticated;

-- Uygulamanın "bugün kalan" bilgisini göstermesi için (kayıt eklemez).
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
    l.per_day,
    (select coalesce(sum(u.amount), 0)::integer from public.usage_events u
      where u.user_id = auth.uid() and u.feature = p_feature and u.created_at >= date_trunc('day', now())),
    l.per_trip,
    (select coalesce(sum(u.amount), 0)::integer from public.usage_events u
      where u.user_id = auth.uid() and u.feature = p_feature and p_trip_id is not null and u.trip_id = p_trip_id)
  from p left join public.plan_limits l on l.plan = p.plan and l.feature = p_feature
  where auth.uid() is not null;
$$;

revoke execute on function public.quota_status(public.quota_feature, uuid) from public, anon;
grant execute on function public.quota_status(public.quota_feature, uuid) to authenticated;
