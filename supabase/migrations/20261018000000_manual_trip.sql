-- Bilet yüklemeden, elle seyahat oluşturma (sadece şehir ve tarihler).
create or replace function public.create_trip_manual(
  p_title text,
  p_start date,
  p_end date,
  p_destinations jsonb,
  p_companion public.companion_type default 'solo',
  p_budget public.budget_tier default 'mid',
  p_interests text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trip uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'invalid dates' using errcode = '22023';
  end if;
  if p_end - p_start > 60 then
    raise exception 'trip too long' using errcode = '22023';
  end if;
  if jsonb_typeof(coalesce(p_destinations, '[]')) <> 'array' or jsonb_array_length(coalesce(p_destinations, '[]')) = 0 then
    raise exception 'at least one destination is required' using errcode = '22023';
  end if;

  insert into public.trips (title, status, start_date, end_date, companion_type, budget_tier, interests)
  values (coalesce(nullif(left(trim(p_title), 120), ''), 'Trip'), 'planned', p_start, p_end, p_companion, p_budget, coalesce(p_interests, '{}'))
  returning id into v_trip;

  insert into public.trip_destinations (trip_id, position, city, country_code, arrive_on, depart_on)
  select
    v_trip,
    (d.ordinality - 1)::smallint,
    left(trim(d.value ->> 'city'), 120),
    nullif(upper(d.value ->> 'country_code'), ''),
    coalesce(nullif(d.value ->> 'arrive_on', '')::date, p_start),
    coalesce(nullif(d.value ->> 'depart_on', '')::date, p_end)
  from jsonb_array_elements(p_destinations) with ordinality as d
  where nullif(trim(d.value ->> 'city'), '') is not null;

  return v_trip;
end;
$$;

revoke execute on function public.create_trip_manual(text, date, date, jsonb, public.companion_type, public.budget_tier, text[]) from public, anon;
grant execute on function public.create_trip_manual(text, date, date, jsonb, public.companion_type, public.budget_tier, text[]) to authenticated;
