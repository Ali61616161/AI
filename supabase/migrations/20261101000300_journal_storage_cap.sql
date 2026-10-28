-- Günlük fotoğraf kovası: kullanıcı başına en fazla 300 dosya (sınırsız depolama istismarını önler).
-- Sayım RLS'yi atlamalı (politika kendi tablosunu sorgulayınca sonsuz özyineleme olur).
create or replace function public.journal_object_count()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select count(*) from storage.objects o
  where o.bucket_id = 'journal' and (storage.foldername(o.name))[1] = (select auth.uid())::text
$$;
revoke execute on function public.journal_object_count() from public, anon;
grant execute on function public.journal_object_count() to authenticated;

drop policy if exists "journal: kendi klasörü" on storage.objects;

create policy "journal: kendi klasörünü okur" on storage.objects
  for select to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "journal: kendi klasörünü günceller" on storage.objects
  for update to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "journal: kendi klasöründen siler" on storage.objects
  for delete to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "journal: kendi klasörüne yazar (üst sınırlı)" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'journal'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and public.journal_object_count() < 300
  );
