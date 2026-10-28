-- =============================================================================
-- Seyahat anıları / günlük: her kullanıcı kendi seyahatleri için günlük not ve fotoğraf tutar.
-- Kayıtlar kişiseldir (ortak seyahatte bile yalnızca yazanı görür); fotoğraflar özel bir kovada durur.
-- =============================================================================

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  entry_date date not null,
  note text not null default '' check (char_length(note) <= 2000),
  mood text check (mood is null or mood in ('amazing', 'good', 'ok', 'tired', 'bad')),
  -- Kovadaki yollar: <user_id>/<trip_id>/<dosya>
  photos text[] not null default '{}' check (cardinality(photos) <= 4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (trip_id, user_id, entry_date),
  check (note <> '' or cardinality(photos) > 0 or mood is not null)
);
create index journal_entries_trip_idx on public.journal_entries (trip_id, user_id, entry_date);

alter table public.journal_entries enable row level security;
create policy "journal: kendi kayıtları" on public.journal_entries
  for all to authenticated
  using (user_id = (select auth.uid()) and public.is_trip_member(trip_id))
  with check (user_id = (select auth.uid()) and public.is_trip_member(trip_id));

-- Fotoğraf yolları yalnızca kendi klasöründen olabilir (başkasının dosyasına bağlanmayı önler).
create or replace function public.journal_entries_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  p text;
begin
  foreach p in array new.photos loop
    if p not like new.user_id::text || '/' || new.trip_id::text || '/%' or p like '%..%' then
      raise exception 'invalid photo path' using errcode = '22023';
    end if;
  end loop;
  new.updated_at := now();
  return new;
end;
$$;
create trigger journal_entries_guard before insert or update on public.journal_entries
  for each row execute function public.journal_entries_guard();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('journal', 'journal', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "journal: kendi klasörü" on storage.objects
  for all to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);
