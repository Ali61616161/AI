-- Günlük: o gün gidilen yerler (plan duraklarından seçilen adlar).
alter table public.journal_entries
  add column places text[] not null default '{}' check (cardinality(places) <= 6);

alter table public.journal_entries drop constraint journal_entries_check;
alter table public.journal_entries
  add constraint journal_entries_not_empty check (note <> '' or cardinality(photos) > 0 or mood is not null or cardinality(places) > 0);
