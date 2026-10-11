-- =============================================================================
-- AI rota motoru: plan kalemlerine ek bilgiler ve planı tek işlemde kaydetme.
-- =============================================================================

alter table public.plan_items
  -- İlgi alanı anahtarı veya check_in/check_out gibi kısa etiket.
  add column category text check (char_length(category) <= 40),
  -- "Yağmur başladı" gibi yeniden planlamalarda kapalı mekanları seçmek için.
  add column is_indoor boolean,
  -- Kalemin gösterileceği yerel saat dilimi (ör. kalkış İstanbul saatiyle).
  add column timezone text;

-- Bir seyahat için yeni plan sürümü oluşturur, günleri ve kalemleri yazar ve
-- sürümü aktif yapar. Hepsi tek işlemde; başarısız olursa önceki plan aktif kalır.
--
-- p_days: [{ date, city, title, notes, items: [{ position, kind, title, description,
--   starts_at, ends_at, timezone, place_name, address, category, estimated_cost,
--   cost_currency, priority, is_indoor, is_locked, reservation_id, affiliate_partner }] }]
create or replace function public.save_plan_version(
  p_trip_id uuid,
  p_reason public.plan_change_reason,
  p_days jsonb,
  p_summary text default null,
  p_user_prompt text default null
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_version integer;
  v_plan uuid;
  v_day jsonb;
  v_day_id uuid;
begin
  if not public.can_edit_trip(p_trip_id) then
    raise exception 'trip not found or not editable' using errcode = '42501';
  end if;
  if jsonb_typeof(p_days) <> 'array' or jsonb_array_length(p_days) = 0 then
    raise exception 'plan needs at least one day' using errcode = '22023';
  end if;

  -- Aynı seyahate eşzamanlı iki plan yazılırsa sürüm numaraları çakışmasın.
  perform 1 from public.trips where id = p_trip_id for update;
  select coalesce(max(version), 0) + 1 into v_version from public.plan_versions where trip_id = p_trip_id;

  insert into public.plan_versions (trip_id, version, reason, summary, user_prompt, is_active)
  values (p_trip_id, v_version, p_reason, left(p_summary, 600), left(p_user_prompt, 1000), false)
  returning id into v_plan;

  for v_day in select * from jsonb_array_elements(p_days) loop
    insert into public.day_plans (plan_version_id, trip_id, date, city, title, notes)
    values (
      v_plan,
      p_trip_id,
      (v_day ->> 'date')::date,
      nullif(v_day ->> 'city', ''),
      nullif(v_day ->> 'title', ''),
      nullif(v_day ->> 'notes', '')
    )
    returning id into v_day_id;

    insert into public.plan_items (
      day_plan_id, trip_id, position, kind, title, description, starts_at, ends_at, timezone,
      place_name, address, category, estimated_cost, cost_currency, priority, is_indoor, is_locked,
      reservation_id, affiliate_partner
    )
    select
      v_day_id,
      p_trip_id,
      coalesce((i ->> 'position')::smallint, (ord - 1)::smallint),
      (i ->> 'kind')::public.plan_item_kind,
      i ->> 'title',
      nullif(i ->> 'description', ''),
      nullif(i ->> 'starts_at', '')::timestamptz,
      nullif(i ->> 'ends_at', '')::timestamptz,
      nullif(i ->> 'timezone', ''),
      nullif(i ->> 'place_name', ''),
      nullif(i ->> 'address', ''),
      nullif(i ->> 'category', ''),
      nullif(i ->> 'estimated_cost', '')::numeric,
      nullif(i ->> 'cost_currency', ''),
      coalesce((i ->> 'priority')::smallint, 3),
      (i ->> 'is_indoor')::boolean,
      coalesce((i ->> 'is_locked')::boolean, false),
      -- Rezervasyon başka bir seyahate aitse bağlanmaz (RLS zaten okumayı engeller).
      (select r.id from public.reservations r where r.id = nullif(i ->> 'reservation_id', '')::uuid and r.trip_id = p_trip_id),
      nullif(i ->> 'affiliate_partner', '')
    from jsonb_array_elements(coalesce(v_day -> 'items', '[]')) with ordinality as x(i, ord);
  end loop;

  perform public.activate_plan_version(v_plan);
  return v_plan;
end;
$$;

revoke execute on function public.save_plan_version(uuid, public.plan_change_reason, jsonb, text, text) from public, anon;
grant execute on function public.save_plan_version(uuid, public.plan_change_reason, jsonb, text, text) to authenticated;
