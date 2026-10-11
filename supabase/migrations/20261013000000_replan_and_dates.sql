-- =============================================================================
-- Planı Değiştir ve tarih değişikliği.
--
-- - Her plan sürümü kaydedildiği andaki seyahat tarihlerini saklar; eski sürüme
--   dönülünce tarihler de geri gelir.
-- - apply_trip_dates: tarihleri ve yeni planı tek işlemde yazar.
-- - restore_plan_version: eski sürümü aktif yapar ve tarihlerini geri yükler.
-- =============================================================================

alter table public.plan_versions
  add column trip_start_date date,
  add column trip_end_date date;

-- Var olan sürümler için o anki seyahat tarihlerini doldur.
update public.plan_versions v
  set trip_start_date = t.start_date, trip_end_date = t.end_date
  from public.trips t
  where t.id = v.trip_id and v.trip_start_date is null;

-- save_plan_version kaydettiği sürüme seyahatin güncel tarihlerini yazar.
create or replace function public.plan_versions_snapshot_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select start_date, end_date into new.trip_start_date, new.trip_end_date
    from public.trips where id = new.trip_id;
  return new;
end;
$$;

create trigger plan_versions_snapshot_dates before insert on public.plan_versions
  for each row execute function public.plan_versions_snapshot_dates();

revoke execute on function public.plan_versions_snapshot_dates() from public, anon, authenticated;

-- Seyahatin tarihlerini değiştirir, durakları yeni aralığa uydurur ve yeni planı
-- kaydeder (p_days boşsa sadece tarihler değişir ve null döner). Rezervasyonlara dokunulmaz: tarih dışında kalanlar uygulamada uyarı olarak
-- gösterilir, silinmez.
create or replace function public.apply_trip_dates(
  p_trip_id uuid,
  p_start date,
  p_end date,
  p_days jsonb,
  p_summary text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_old_start date;
  v_old_end date;
begin
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'invalid date range' using errcode = '22023';
  end if;
  if not public.can_edit_trip(p_trip_id) then
    raise exception 'trip not found or not editable' using errcode = '42501';
  end if;

  select start_date, end_date into v_old_start, v_old_end from public.trips where id = p_trip_id for update;

  update public.trips set start_date = p_start, end_date = p_end where id = p_trip_id;

  -- Aralığın tamamen dışında kalan duraklar çıkarılır; sınırdaki duraklar uzar veya kısalır.
  delete from public.trip_destinations
    where trip_id = p_trip_id and (arrive_on > p_end or depart_on < p_start);
  update public.trip_destinations
    set arrive_on = case when arrive_on is not distinct from v_old_start or arrive_on < p_start then p_start else arrive_on end,
        depart_on = case when depart_on is not distinct from v_old_end or depart_on > p_end then p_end else depart_on end
    where trip_id = p_trip_id;

  -- Henüz rotası olmayan seyahatte sadece tarihler değişir.
  if coalesce(jsonb_array_length(p_days), 0) = 0 then
    return null;
  end if;

  return public.save_plan_version(p_trip_id, 'dates_changed', p_days, p_summary,
    format('%s → %s', p_start, p_end));
end;
$$;

-- Eski bir plan sürümüne döner: sürümü aktif yapar ve seyahatin tarihlerini o
-- sürümün kaydedildiği andaki tarihlere getirir.
create or replace function public.restore_plan_version(p_version_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.plan_versions%rowtype;
begin
  select * into v from public.plan_versions where id = p_version_id;
  if not found or not public.can_edit_trip(v.trip_id) then
    raise exception 'plan version not found or not editable' using errcode = '42501';
  end if;
  if v.trip_start_date is not null and v.trip_end_date is not null then
    update public.trips set start_date = v.trip_start_date, end_date = v.trip_end_date where id = v.trip_id;
  end if;
  perform public.activate_plan_version(p_version_id);
end;
$$;

revoke execute on function public.apply_trip_dates(uuid, date, date, jsonb, text) from public, anon;
grant execute on function public.apply_trip_dates(uuid, date, date, jsonb, text) to authenticated;
revoke execute on function public.restore_plan_version(uuid) from public, anon;
grant execute on function public.restore_plan_version(uuid) to authenticated;
