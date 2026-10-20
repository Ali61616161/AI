-- Seyahat paylaşımı: Pro üye, arkadaşlarını e-postayla "yalnızca görüntüleyen" olarak ekler.
-- Davet edilen kişi aynı e-postayla uygulamaya girince daveti görür (ya da bağlantıyı açar) ve kabul eder.
-- Görüntüleyici (viewer) seyahati okur ama hiçbir şeyi değiştiremez: mevcut politikalar yazmayı
-- yalnızca owner/editor'e verir.

create table public.trip_invites (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  email text not null check (email = lower(email) and length(email) between 5 and 254),
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  invited_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  accepted_at timestamptz,
  unique (trip_id, email)
);

alter table public.trip_invites enable row level security;

-- Davetleri yalnızca seyahatin sahibi görür; ekleme/silme/kabul aşağıdaki işlevlerle yapılır.
create policy "trip_invites: sahibi okur" on public.trip_invites
  for select to authenticated using (public.is_trip_owner(trip_id));

-- Bir seyahatte en fazla bu kadar davet/görüntüleyici olur (kötüye kullanımı sınırlar).
create or replace function public.create_trip_invite(p_trip_id uuid, p_email text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(p_email));
  v_token text;
  v_own text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if not public.is_trip_owner(p_trip_id) then
    raise exception 'only the trip owner can invite' using errcode = '42501';
  end if;
  if public.current_plan(null) not in ('pro_monthly', 'pro_yearly') then
    raise exception 'pro required' using errcode = 'P0001';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then
    raise exception 'invalid email' using errcode = '22023';
  end if;
  select lower(email) into v_own from auth.users where id = auth.uid();
  if v_own = v_email then
    raise exception 'cannot invite yourself' using errcode = '22023';
  end if;
  if (select count(*) from public.trip_invites where trip_id = p_trip_id) >= 10
     and not exists (select 1 from public.trip_invites where trip_id = p_trip_id and email = v_email) then
    raise exception 'too many invites' using errcode = 'P0001';
  end if;

  insert into public.trip_invites (trip_id, email, invited_by)
  values (p_trip_id, v_email, auth.uid())
  on conflict (trip_id, email) do update
    set expires_at = now() + interval '30 days', invited_by = auth.uid()
  returning token into v_token;
  return v_token;
end;
$$;

-- Giriş yapan kullanıcının e-postasına gelen bekleyen davetler (e-posta doğrulanmış olmalı).
create or replace function public.my_trip_invites()
returns table (token text, trip_id uuid, trip_title text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select i.token, i.trip_id, t.title, i.created_at
  from public.trip_invites i
  join public.trips t on t.id = i.trip_id
  join auth.users u on u.id = auth.uid()
  where i.email = lower(u.email)
    and u.email_confirmed_at is not null
    and i.accepted_at is null
    and i.expires_at > now()
  order by i.created_at desc;
$$;

create or replace function public.accept_trip_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.trip_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select lower(email) into v_email from auth.users where id = auth.uid() and email_confirmed_at is not null;
  select * into v_invite from public.trip_invites where token = p_token and expires_at > now();
  if v_invite.id is null or v_email is null or v_invite.email <> v_email then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  insert into public.trip_members (trip_id, user_id, role)
  values (v_invite.trip_id, auth.uid(), 'viewer')
  on conflict (trip_id, user_id) do nothing;
  update public.trip_invites set accepted_at = coalesce(accepted_at, now()) where id = v_invite.id;
  return v_invite.trip_id;
end;
$$;

-- Sahip daveti geri alır; kabul edilmişse görüntüleyiciyi de seyahatten çıkarır.
create or replace function public.revoke_trip_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_invite public.trip_invites%rowtype;
begin
  select * into v_invite from public.trip_invites where id = p_invite_id;
  if v_invite.id is null or not public.is_trip_owner(v_invite.trip_id) then
    raise exception 'invite not found' using errcode = 'P0002';
  end if;
  delete from public.trip_members m
  using auth.users u
  where m.trip_id = v_invite.trip_id and m.user_id = u.id and lower(u.email) = v_invite.email and m.role = 'viewer';
  delete from public.trip_invites where id = p_invite_id;
end;
$$;

revoke all on function public.create_trip_invite(uuid, text), public.my_trip_invites(),
  public.accept_trip_invite(text), public.revoke_trip_invite(uuid) from public, anon;
grant execute on function public.create_trip_invite(uuid, text), public.my_trip_invites(),
  public.accept_trip_invite(text), public.revoke_trip_invite(uuid) to authenticated;
