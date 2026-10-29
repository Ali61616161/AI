-- Plan metinlerinin başka dile çevirisi (Google Cloud Translation): dil değişince eski dilde üretilmiş rota yeni dilde gösterilir.
-- Her (plan sürümü, dil) ikilisi bir kez çevrilir. İstemci okuyamaz/yazamaz (politika yok); yalnızca translate-plan işlevi (service_role) kullanır.
create table public.plan_translations (
  plan_version_id uuid not null references public.plan_versions (id) on delete cascade,
  language text not null check (language in ('tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh')),
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  primary key (plan_version_id, language)
);
alter table public.plan_translations enable row level security;
revoke all on public.plan_translations from anon, authenticated;
