-- Kısa metin çevirileri (Google Cloud Translation): yolculuk raporu ve günlük notları gibi başka dilde saklanmış içerikler
-- dil değişince yeni dilde gösterilir. Anahtar: metnin SHA-256 özeti + dil. İstemci okuyamaz/yazamaz; yalnızca translate-texts
-- işlevi (service_role) kullanır.
create table public.text_translations (
  text_hash text not null check (char_length(text_hash) = 64),
  language text not null check (language in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh')),
  translated text not null check (char_length(translated) <= 6000),
  created_at timestamptz not null default now(),
  primary key (text_hash, language)
);
alter table public.text_translations enable row level security;
revoke all on public.text_translations from anon, authenticated;
