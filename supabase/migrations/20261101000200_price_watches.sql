-- =============================================================================
-- Uçak bileti fiyat takibi: kullanıcı rota + tarih (+ hedef fiyat) kaydeder; sunucu (6 saatte bir)
-- en ucuz fiyatı kontrol eder ve düşünce anlık bildirim gönderir.
-- =============================================================================

create table public.price_watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  origin_code text not null check (origin_code ~ '^[A-Z]{3}$'),
  origin_name text not null check (char_length(origin_name) between 1 and 80),
  destination_code text not null check (destination_code ~ '^[A-Z]{3}$' and destination_code <> origin_code),
  destination_name text not null check (char_length(destination_name) between 1 and 80),
  depart_on date not null,
  return_on date,
  -- Tarih esnek: depart_on ayındaki en ucuz gün aranır.
  flexible_month boolean not null default false,
  target_price numeric(10, 2) check (target_price is null or (target_price > 0 and target_price < 1000000)),
  currency text not null default 'EUR' check (currency in ('EUR', 'USD', 'TRY', 'GBP')),
  active boolean not null default true,
  -- Sunucu tarafından yazılır (istemci yazamaz):
  last_price numeric(10, 2),
  lowest_price numeric(10, 2),
  last_airline text,
  last_checked_at timestamptz,
  last_alert_price numeric(10, 2),
  -- Son 30 kontrolün [{d: 'YYYY-MM-DD', p: fiyat}] kaydı (grafik için).
  price_points jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  check (return_on is null or return_on > depart_on)
);
create index price_watches_active_idx on public.price_watches (active, depart_on);
create index price_watches_user_idx on public.price_watches (user_id);

alter table public.price_watches enable row level security;
create policy "price_watches: kendi kayıtları" on public.price_watches
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Yazma yetkisi sütun düzeyinde: sistem sütunlarını istemci yazamaz.
revoke insert, update on public.price_watches from authenticated, anon;
grant insert (origin_code, origin_name, destination_code, destination_name, depart_on, return_on, flexible_month, target_price, currency)
  on public.price_watches to authenticated;
grant update (active, target_price) on public.price_watches to authenticated;

-- En fazla 5 aktif takip; geçmiş tarihe takip kurulamaz.
create or replace function public.price_watches_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' or (tg_op = 'UPDATE' and new.active and not old.active) then
    if new.active and (select count(*) from public.price_watches where user_id = new.user_id and active and id <> new.id) >= 5 then
      raise exception 'price watch limit' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'INSERT' and new.depart_on < current_date then
    raise exception 'depart date in the past' using errcode = '22023';
  end if;
  return new;
end;
$$;
create trigger price_watches_guard before insert or update on public.price_watches
  for each row execute function public.price_watches_guard();

-- 6 saatte bir fiyat kontrolü (pg_cron/pg_net yoksa sessizce atlanır).
do $$
begin
  create extension if not exists pg_net with schema extensions;
  create extension if not exists pg_cron with schema pg_catalog;
  perform cron.schedule(
    'price-watch',
    '17 */6 * * *',
    $job$
    select net.http_post(
      url := (select value from public.internal_config where key = 'functions_url') || '/price-watch',
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', (select value from public.internal_secrets where key = 'cron')),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
    $job$
  );
exception when others then
  raise notice 'pg_cron/pg_net kurulamadı, price-watch zamanlanmadı: %', sqlerrm;
end;
$$;
