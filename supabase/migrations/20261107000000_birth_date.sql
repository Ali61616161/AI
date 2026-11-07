-- =============================================================================
-- Gezginler: yaş kontrolü doğum yılı yerine tam doğum tarihiyle yapılır.
-- Yıl farkıyla 18 kontrolü, doğum günü henüz gelmemiş 17 yaşındakini yanlışlıkla 18+ sayardı.
-- Eski birth_year sütunu geriye dönük uyumluluk için kalır ve doğum tarihinden türetilir.
-- =============================================================================

alter table public.profiles add column birth_date date check (birth_date >= date '1900-01-01');

grant update (birth_date) on public.profiles to authenticated;

-- 18 yaşını doldurmuş mu? Doğum tarihi varsa tam tarihle, yoksa (eski kayıtlar) yılla bakar.
create or replace function public.is_adult(p_birth_date date, p_birth_year smallint)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case
    when p_birth_date is not null then p_birth_date <= (current_date - interval '18 years')::date
    when p_birth_year is not null then extract(year from now())::int - p_birth_year >= 18
    else false
  end
$$;
revoke execute on function public.is_adult(date, smallint) from public, anon;
grant execute on function public.is_adult(date, smallint) to authenticated, service_role;

-- Doğum tarihi gelecekte olamaz; birth_year tarihten türetilir.
create or replace function public.profiles_birth_date_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.birth_date is not null then
    if new.birth_date > current_date then
      raise exception 'birth date cannot be in the future' using errcode = '23514', hint = 'invalid_birth_date';
    end if;
    new.birth_year := extract(year from new.birth_date)::smallint;
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_birth_date_sync() from public, anon, authenticated;

create trigger profiles_birth_date_sync before insert or update on public.profiles
  for each row execute function public.profiles_birth_date_sync();

-- Doğum tarihi de bir kez belirlenince değiştirilemez (cinsiyet ve doğum yılı kilidiyle aynı kural).
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
    if old.birth_year is not null and new.birth_year is distinct from old.birth_year and new.birth_date is null then
      raise exception 'birth year cannot be changed' using errcode = '42501', hint = 'identity_locked';
    end if;
    if old.birth_date is not null and new.birth_date is distinct from old.birth_date then
      raise exception 'birth date cannot be changed' using errcode = '42501', hint = 'identity_locked';
    end if;
    -- Eski kayıtta yıl varken tarih ilk kez yazılıyorsa yıl ile uyumlu olmalı.
    if old.birth_year is not null and old.birth_date is null and new.birth_date is not null
       and extract(year from new.birth_date)::smallint <> old.birth_year then
      raise exception 'birth date must match the saved birth year' using errcode = '42501', hint = 'identity_locked';
    end if;
  end if;
  return new;
end;
$$;
revoke execute on function public.profiles_identity_fields_locked() from public, anon, authenticated;

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
    if exists (select 1 from public.social_suspensions s where s.user_id = new.user_id and s.suspended_until > now()) then
      raise exception 'social mode is suspended' using errcode = '42501', hint = 'suspended';
    end if;
    if not public.is_adult(v_profile.birth_date, v_profile.birth_year) then
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
  v_my public.profiles%rowtype;
begin
  select * into v_me from public.social_profiles sp where sp.user_id = auth.uid() and sp.is_visible;
  if not found or v_me.approx_location is null then
    return;
  end if;
  select * into v_my from public.profiles p where p.id = auth.uid();
  if not public.is_adult(v_my.birth_date, v_my.birth_year) then
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
    and public.is_adult(p.birth_date, p.birth_year)
    and extensions.st_dwithin(sp.approx_location, v_me.approx_location, least(p_radius_km, 50) * 1000)
    and (sp.available_until is null or sp.available_until >= current_date)
    and not public.is_blocked_between(sp.user_id, auth.uid())
  order by extensions.st_distance(sp.approx_location, v_me.approx_location)
  limit 50;
end;
$$;
