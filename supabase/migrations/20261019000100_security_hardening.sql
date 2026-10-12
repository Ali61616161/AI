-- =============================================================================
-- Güvenlik sıkılaştırması (yayın öncesi denetim):
--  1. Üye satırı başka bir seyahate taşınamaz; sahip sadece rol değiştirir.
--  2. Seyahatin sahibi (owner_id) istemciden değiştirilemez.
--  3. Cinsiyet ve doğum yılı bir kez belirlendikten sonra istemciden değiştirilemez
--     ("sadece kadınlar" ve 18+ koşullarının atlatılmaması için); yakındaki
--     gezginler listesinde yaş yeniden kontrol edilir.
--  4. Plan bağlantıları sadece https; profil fotoğrafı sadece kendi depolama alanı.
--  5. Hava durumu ve AI seyahat raporu için kota.
-- =============================================================================

-- 1. trip_members: sadece role sütunu güncellenebilir; sahip satırı değiştirilemez.
revoke update on public.trip_members from authenticated, anon;
grant update (role) on public.trip_members to authenticated;
drop policy "trip_members: sahibi rol değiştirir" on public.trip_members;
create policy "trip_members: sahibi rol değiştirir" on public.trip_members
  for update to authenticated
  using (public.is_trip_owner(trip_id) and role <> 'owner')
  with check (public.is_trip_owner(trip_id) and role <> 'owner');

-- 2. trips.owner_id istemciden değişmez (sunucu/servis rolü değiştirebilir).
create or replace function public.trips_owner_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id and current_user in ('authenticated', 'anon') then
    raise exception 'trip owner cannot be changed' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke execute on function public.trips_owner_immutable() from public, anon, authenticated;

create trigger trips_owner_immutable before update on public.trips
  for each row execute function public.trips_owner_immutable();

-- 3. Cinsiyet ve doğum yılı kilidi.
create or replace function public.profiles_identity_fields_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if old.gender <> 'undisclosed' and new.gender is distinct from old.gender then
      raise exception 'gender cannot be changed' using errcode = '42501', hint = 'identity_locked';
    end if;
    if old.birth_year is not null and new.birth_year is distinct from old.birth_year then
      raise exception 'birth year cannot be changed' using errcode = '42501', hint = 'identity_locked';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_identity_fields_locked() from public, anon, authenticated;

create trigger profiles_identity_fields_locked before update on public.profiles
  for each row execute function public.profiles_identity_fields_locked();

-- Yakındaki gezginler: karşı taraf da 18+ olmalı (önceki sürüme yaş koşulu eklendi).
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
  v_my_birth_year smallint;
begin
  select * into v_me from public.social_profiles sp where sp.user_id = auth.uid() and sp.is_visible;
  if not found or v_me.approx_location is null then
    return;
  end if;
  select p.gender, p.birth_year into v_my_gender, v_my_birth_year from public.profiles p where p.id = auth.uid();
  if v_my_birth_year is null or extract(year from now())::int - v_my_birth_year < 18 then
    return;
  end if;

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
    and p.birth_year is not null
    and extract(year from now())::int - p.birth_year >= 18
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

-- 4. Bağlantılar sadece https. Var olan geçersiz değerler temizlenir.
update public.plan_items set booking_url = null where booking_url is not null and booking_url !~ '^https://';
update public.plan_items set maps_url = null where maps_url is not null and maps_url !~ '^https://';
alter table public.plan_items
  add constraint plan_items_booking_url_https check (booking_url ~ '^https://'),
  add constraint plan_items_maps_url_https check (maps_url ~ '^https://');

-- Profil fotoğrafı sadece bu projenin herkese açık "avatars" alanından.
update public.profiles set avatar_url = null
  where avatar_url is not null and avatar_url !~ '^https://[^/]+/storage/v1/object/public/avatars/';
alter table public.profiles
  add constraint profiles_avatar_url_storage check (avatar_url ~ '^https://[^/]+/storage/v1/object/public/avatars/');

-- 5. Kotalar: hava durumu günlük, AI raporu seyahat başına.
insert into public.plan_limits (plan, feature, per_trip, per_day) values
  ('free', 'weather', null, 40),
  ('trip_pass', 'weather', null, 200),
  ('pro_monthly', 'weather', null, 200),
  ('pro_yearly', 'weather', null, 200),
  ('free', 'trip_report', 3, null),
  ('trip_pass', 'trip_report', 10, null),
  ('pro_monthly', 'trip_report', 10, null),
  ('pro_yearly', 'trip_report', 10, null)
on conflict (plan, feature) do nothing;
