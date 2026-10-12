-- =============================================================================
-- "Sadece kadın gezginler" filtresi kaldırıldı: cinsiyet beyana dayalıydı ve kimlik
-- doğrulaması olmadan istismar edilebilirdi. Doğrulama eklenince yeniden ele alınacak.
-- Cinsiyet artık hiçbir işlevde kullanılmadığı için kayıtlı değerler de silinir
-- (veri minimizasyonu).
-- =============================================================================

create or replace function public.social_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = new.user_id;
  if new.is_visible then
    if v_profile.birth_year is null or extract(year from now())::int - v_profile.birth_year < 18 then
      raise exception 'social mode requires age 18+' using errcode = '42501', hint = 'age_required';
    end if;
    if v_profile.display_name is null or char_length(trim(v_profile.display_name)) = 0 then
      raise exception 'social mode requires a display name' using errcode = '23514', hint = 'name_required';
    end if;
  end if;
  return new;
end;
$$;

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
  v_my_birth_year smallint;
begin
  select * into v_me from public.social_profiles sp where sp.user_id = auth.uid() and sp.is_visible;
  if not found or v_me.approx_location is null then
    return;
  end if;
  select p.birth_year into v_my_birth_year from public.profiles p where p.id = auth.uid();
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
  order by extensions.st_distance(sp.approx_location, v_me.approx_location)
  limit 50;
end;
$$;

alter table public.social_profiles drop column women_only;

update public.profiles set gender = 'undisclosed' where gender <> 'undisclosed';
