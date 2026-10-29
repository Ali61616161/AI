-- Yeni arayüz dilleri: pt, ja, ko, nl, pl, hi, id.
alter table public.profiles drop constraint profiles_preferred_language_check;
alter table public.profiles add constraint profiles_preferred_language_check
  check (preferred_language in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh', 'pt', 'ja', 'ko', 'nl', 'pl', 'hi', 'id'));

alter table public.plan_translations drop constraint plan_translations_language_check;
alter table public.plan_translations add constraint plan_translations_language_check
  check (language in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh', 'pt', 'ja', 'ko', 'nl', 'pl', 'hi', 'id'));

alter table public.text_translations drop constraint text_translations_language_check;
alter table public.text_translations add constraint text_translations_language_check
  check (language in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh', 'pt', 'ja', 'ko', 'nl', 'pl', 'hi', 'id'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  lang text := new.raw_user_meta_data ->> 'language';
begin
  insert into public.profiles (id, display_name, preferred_language)
  values (
    new.id,
    new.raw_user_meta_data ->> 'display_name',
    case when lang in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh', 'pt', 'ja', 'ko', 'nl', 'pl', 'hi', 'id') then lang else 'en' end
  );
  return new;
end;
$$;
