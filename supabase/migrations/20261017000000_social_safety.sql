-- =============================================================================
-- Sosyal mod güvenliği: yaş ve "sadece kadınlar" koşulları, engellenince bekleyen
-- davetlerin iptali ve davet listesinde karşı tarafın sınırlı bilgileri.
-- =============================================================================

-- Görünür olmak için 18 yaş ve üstü olmak gerekir; "sadece kadın gezginler"
-- filtresini sadece cinsiyetini kadın olarak belirtenler açabilir.
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
  if new.women_only and v_profile.gender <> 'female' then
    raise exception 'women-only filter is for women' using errcode = '42501', hint = 'women_only';
  end if;
  return new;
end;
$$;

create trigger social_profiles_guard before insert or update on public.social_profiles
  for each row execute function public.social_profiles_guard();

-- Engellenince aradaki bekleyen ve kabul edilmiş davetler iptal olur.
create or replace function public.user_blocks_cancel_invites()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.match_invites
    set status = 'cancelled', responded_at = now()
    where status in ('pending', 'accepted')
      and ((from_user = new.blocker_id and to_user = new.blocked_id) or (from_user = new.blocked_id and to_user = new.blocker_id));
  return new;
end;
$$;

create trigger user_blocks_cancel_invites after insert on public.user_blocks
  for each row execute function public.user_blocks_cancel_invites();

-- Kullanıcının davetleri, karşı tarafın sadece görünen adı, fotoğrafı ve doğrulama
-- durumuyla (profiller başkalarına kapalıdır). Engellenenler listelenmez.
create or replace function public.my_invites()
returns table (
  id uuid,
  incoming boolean,
  status public.invite_status,
  place_name text,
  google_place_id text,
  place_lat double precision,
  place_lng double precision,
  meet_at timestamptz,
  message text,
  created_at timestamptz,
  other_id uuid,
  other_name text,
  other_avatar text,
  other_verified boolean,
  last_message text,
  last_message_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    i.id,
    i.to_user = auth.uid(),
    i.status,
    i.place_name,
    i.google_place_id,
    extensions.st_y(i.place_location::extensions.geometry),
    extensions.st_x(i.place_location::extensions.geometry),
    i.meet_at,
    i.message,
    i.created_at,
    o.id,
    o.display_name,
    o.avatar_url,
    o.identity_verified_at is not null,
    m.body,
    m.created_at
  from public.match_invites i
  join public.profiles o on o.id = case when i.from_user = auth.uid() then i.to_user else i.from_user end
  left join lateral (
    select body, created_at from public.messages where invite_id = i.id order by created_at desc limit 1
  ) m on true
  where auth.uid() in (i.from_user, i.to_user)
    and not public.is_blocked_between(i.from_user, i.to_user)
    and i.created_at > now() - interval '60 days'
  order by coalesce(m.created_at, i.created_at) desc;
$$;

revoke execute on function public.my_invites() from public, anon;
grant execute on function public.my_invites() to authenticated;
