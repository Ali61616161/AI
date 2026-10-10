-- =============================================================================
-- Onaylanan belgelerden seyahat oluşturma (veya mevcut seyahate ekleme).
--
-- Seyahat, şehirler, rezervasyonlar ve belge durumları tek işlemde yazılır;
-- herhangi bir adım başarısız olursa hiçbiri kaydedilmez.
--
-- SECURITY INVOKER: tüm yazmalar çağıran kullanıcının RLS kurallarıyla yapılır.
-- =============================================================================
-- Düzeltme: INSERT ... RETURNING yeni satırın okuma kuralını da kontrol eder.
-- Sahip, trip_members'a ekleme sonrası tetikleyiciyle eklendiği için ekleme
-- anında "üye" değildi ve seyahat oluşturup geri okumak RLS hatası veriyordu.
-- Sahip artık seyahatini her zaman okuyabilir.
drop policy "trips: üyeler okur" on public.trips;
create policy "trips: sahibi ve üyeler okur" on public.trips
  for select to authenticated using (owner_id = (select auth.uid()) or public.is_trip_member(id));

create or replace function public.create_trip_from_documents(
  p_trip jsonb,
  p_destinations jsonb,
  p_reservations jsonb,
  p_document_ids uuid[],
  p_trip_id uuid default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_trip uuid := p_trip_id;
  v_start date := nullif(p_trip ->> 'start_date', '')::date;
  v_end date := nullif(p_trip ->> 'end_date', '')::date;
  v_position smallint;
  v_updated integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if jsonb_typeof(coalesce(p_reservations, '[]')) <> 'array' or jsonb_array_length(coalesce(p_reservations, '[]')) = 0 then
    raise exception 'at least one reservation is required' using errcode = '22023';
  end if;

  if v_trip is null then
    insert into public.trips (title, status, start_date, end_date, companion_type, budget_tier, interests, budget_currency)
    values (
      coalesce(nullif(trim(p_trip ->> 'title'), ''), 'Trip'),
      'planned',
      v_start,
      v_end,
      coalesce((p_trip ->> 'companion_type')::public.companion_type, 'solo'),
      coalesce((p_trip ->> 'budget_tier')::public.budget_tier, 'mid'),
      coalesce(array(select jsonb_array_elements_text(p_trip -> 'interests')), '{}'),
      nullif(p_trip ->> 'budget_currency', '')
    )
    returning id into v_trip;
  else
    if not public.can_edit_trip(v_trip) then
      raise exception 'trip not found or not editable' using errcode = '42501';
    end if;
    -- Yeni belgeler seyahatin tarihlerini genişletebilir, daraltmaz.
    update public.trips
      set start_date = least(coalesce(start_date, v_start), coalesce(v_start, start_date)),
          end_date = greatest(coalesce(end_date, v_end), coalesce(v_end, end_date)),
          status = case when status = 'draft' then 'planned'::public.trip_status else status end
      where id = v_trip;
  end if;

  select coalesce(max(position) + 1, 0) into v_position from public.trip_destinations where trip_id = v_trip;

  insert into public.trip_destinations (trip_id, position, city, country_code, arrive_on, depart_on)
  select
    v_trip,
    v_position + (d.ordinality - 1)::smallint,
    d.value ->> 'city',
    nullif(d.value ->> 'country_code', ''),
    nullif(d.value ->> 'arrive_on', '')::date,
    nullif(d.value ->> 'depart_on', '')::date
  from jsonb_array_elements(coalesce(p_destinations, '[]')) with ordinality as d
  where nullif(trim(d.value ->> 'city'), '') is not null
    -- Aynı şehir aynı varış tarihiyle zaten varsa tekrar eklenmez.
    and not exists (
      select 1 from public.trip_destinations e
      where e.trip_id = v_trip
        and lower(e.city) = lower(d.value ->> 'city')
        and e.arrive_on is not distinct from nullif(d.value ->> 'arrive_on', '')::date
    );

  insert into public.reservations (
    trip_id, document_id, type, title, provider_name, reference_code, starts_at, ends_at,
    start_timezone, end_timezone, origin_name, origin_code, destination_name, destination_code,
    address, details
  )
  select
    v_trip,
    nullif(r ->> 'document_id', '')::uuid,
    (r ->> 'type')::public.reservation_type,
    r ->> 'title',
    nullif(r ->> 'provider_name', ''),
    nullif(r ->> 'reference_code', ''),
    (r ->> 'starts_at')::timestamptz,
    nullif(r ->> 'ends_at', '')::timestamptz,
    nullif(r ->> 'start_timezone', ''),
    nullif(r ->> 'end_timezone', ''),
    nullif(r ->> 'origin_name', ''),
    nullif(r ->> 'origin_code', ''),
    nullif(r ->> 'destination_name', ''),
    nullif(r ->> 'destination_code', ''),
    nullif(r ->> 'address', ''),
    coalesce(r -> 'details', '{}')
  from jsonb_array_elements(p_reservations) as r;

  if coalesce(array_length(p_document_ids, 1), 0) > 0 then
    update public.documents
      set trip_id = v_trip, status = 'confirmed'
      where id = any(p_document_ids);
    get diagnostics v_updated = row_count;
    -- RLS başkasının belgesini sessizce atlar; bu durumda işlemi tamamen geri al.
    if v_updated <> array_length(p_document_ids, 1) then
      raise exception 'one or more documents not found' using errcode = '42501';
    end if;
  end if;

  return v_trip;
end;
$$;

revoke execute on function public.create_trip_from_documents(jsonb, jsonb, jsonb, uuid[], uuid) from public, anon;
grant execute on function public.create_trip_from_documents(jsonb, jsonb, jsonb, uuid[], uuid) to authenticated;
