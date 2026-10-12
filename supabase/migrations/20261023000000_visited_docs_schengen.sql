-- Gezdiğim ülkeler, belge son kullanma tarihleri ve Schengen 90/180 kayıtları.

-- -----------------------------------------------------------------------------
-- 1. Gezdiğim ülkeler: kullanıcının işaretledikleri ('self') ve Yola seyahatleri ('trip')
-- -----------------------------------------------------------------------------
create table public.visited_countries (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  country_code text not null check (country_code ~ '^[A-Z]{2}$'),
  source text not null default 'self' check (source in ('self', 'trip')),
  created_at timestamptz not null default now(),
  primary key (user_id, country_code)
);

alter table public.visited_countries enable row level security;

create policy "visited_countries: kendi kayıtlarını okur" on public.visited_countries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "visited_countries: kendi adına ekler" on public.visited_countries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "visited_countries: kendi kaydını günceller" on public.visited_countries
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "visited_countries: kendi kaydını siler" on public.visited_countries
  for delete to authenticated using (user_id = (select auth.uid()));

-- "Gezginlerin %X'inden fazla ülke gezdin": sadece en az 1000 kullanıcı ülke
-- işaretlediğinde hesaplanır (az veriyle yanıltıcı olmasın). Kimsenin verisini açmaz.
create or replace function public.visited_percentile()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  with counts as (select user_id, count(*) as n from public.visited_countries group by user_id),
  me as (select count(*) as n from public.visited_countries where user_id = auth.uid())
  select case
    when auth.uid() is null or (select count(*) from counts) < 1000 then null
    else (select floor(100.0 * count(*) filter (where c.n < me.n) / count(*))::integer from counts c, me)
  end;
$$;
revoke execute on function public.visited_percentile() from public, anon;
grant execute on function public.visited_percentile() to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Belgeler: sadece tür, ülke ve son kullanma tarihi (belge numarası saklanmaz)
-- -----------------------------------------------------------------------------
create table public.travel_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('passport', 'visa', 'residence', 'id_card', 'other')),
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  label text check (char_length(label) <= 60),
  expires_on date not null,
  created_at timestamptz not null default now()
);

create index travel_documents_user_idx on public.travel_documents (user_id, expires_on);

alter table public.travel_documents enable row level security;

create policy "travel_documents: kendi kayıtlarını okur" on public.travel_documents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "travel_documents: kendi adına ekler" on public.travel_documents
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "travel_documents: kendi kaydını günceller" on public.travel_documents
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "travel_documents: kendi kaydını siler" on public.travel_documents
  for delete to authenticated using (user_id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- 3. Schengen bölgesindeki kalışlar (90/180 kuralı hesaplayıcısı için)
-- -----------------------------------------------------------------------------
create table public.schengen_stays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_on date not null,
  exit_on date not null,
  note text check (char_length(note) <= 60),
  created_at timestamptz not null default now(),
  constraint schengen_stays_dates check (exit_on >= entry_on and exit_on - entry_on <= 366)
);

create index schengen_stays_user_idx on public.schengen_stays (user_id, entry_on);

alter table public.schengen_stays enable row level security;

create policy "schengen_stays: kendi kayıtlarını okur" on public.schengen_stays
  for select to authenticated using (user_id = (select auth.uid()));
create policy "schengen_stays: kendi adına ekler" on public.schengen_stays
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "schengen_stays: kendi kaydını günceller" on public.schengen_stays
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "schengen_stays: kendi kaydını siler" on public.schengen_stays
  for delete to authenticated using (user_id = (select auth.uid()));
