-- =============================================================================
-- Anlık bildirim (push) altyapısı: cihaz kayıtları, gönderilen bildirimlerin takibi ve 15 dakikada bir
-- çalışan uçuş kontrolü (pg_cron + pg_net → flight-watch Edge Function'ı).
-- =============================================================================

-- Cihaz kayıtları. Bir token aynı anda tek hesaba bağlıdır (cihazda hesap değişince yeni hesaba geçer).
create table public.push_tokens (
  token text primary key check (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,100}\]$'),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  updated_at timestamptz not null default now()
);
create index push_tokens_user_idx on public.push_tokens (user_id);
alter table public.push_tokens enable row level security;
create policy "push_tokens: kendi kayıtlarını okur" on public.push_tokens
  for select to authenticated using (user_id = (select auth.uid()));
-- Yazma yalnızca aşağıdaki işlevlerle (başkasının token'ını ele geçirme ve sınırsız kayıt engellenir).
revoke insert, update, delete on public.push_tokens from authenticated, anon;

create or replace function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;
  -- Kullanıcı başına en fazla 10 cihaz.
  if (select count(*) from public.push_tokens where user_id = auth.uid() and token <> p_token) >= 10 then
    delete from public.push_tokens where token in (
      select token from public.push_tokens where user_id = auth.uid() and token <> p_token order by updated_at asc limit 1
    );
  end if;
  insert into public.push_tokens (token, user_id, platform) values (p_token, auth.uid(), p_platform)
  on conflict (token) do update set user_id = auth.uid(), platform = excluded.platform, updated_at = now();
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = auth.uid();
$$;

revoke execute on function public.register_push_token(text, text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

-- Aynı gecikme/iptal için bir kullanıcıya tekrar bildirim gitmesin.
create table public.flight_alerts_sent (
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  alert_key text not null,
  sent_at timestamptz not null default now(),
  primary key (reservation_id, alert_key)
);
alter table public.flight_alerts_sent enable row level security;
revoke all on public.flight_alerts_sent from anon, authenticated;

-- Sunucu içi yapılandırma ve sırlar: istemciye kapalı (politika yok, yetki yok).
create table public.internal_config (key text primary key, value text not null);
create table public.internal_secrets (key text primary key, value text not null);
alter table public.internal_config enable row level security;
alter table public.internal_secrets enable row level security;
revoke all on public.internal_config from anon, authenticated;
revoke all on public.internal_secrets from anon, authenticated;

-- Zamanlayıcı ile Edge Function arasındaki ortak sır: veritabanında üretilir, hiçbir yere yazılmaz.
insert into public.internal_secrets (key, value) values ('cron', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''));
-- Fonksiyonların adresi (herkese açık bilgi; uygulamadaki adresle aynı proje).
insert into public.internal_config (key, value) values ('functions_url', 'https://qdbjojitkyfnekvftjrc.supabase.co/functions/v1');

-- 15 dakikada bir uçuş kontrolü. pg_cron/pg_net yoksa (ör. yerel test veritabanı) sessizce atlanır.
do $$
begin
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule(
    'flight-watch',
    '*/15 * * * *',
    $job$
    select net.http_post(
      url := (select value from public.internal_config where key = 'functions_url') || '/flight-watch',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from public.internal_secrets where key = 'cron')),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net kurulamadı, flight-watch zamanlanmadı: %', sqlerrm;
end;
$$;
