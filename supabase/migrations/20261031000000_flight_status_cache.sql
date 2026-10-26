-- Uçuş durumu önbelleği: aynı uçuşu izleyen herkes için servise tek istek gider (ücretsiz kota korunur).
-- İstemci okuyamaz/yazamaz (politika yok); yalnızca flight-status Edge Function'ı (service_role) kullanır.
create table public.flight_status_cache (
  flight_number text not null check (flight_number ~ '^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$'),
  flight_date date not null,
  origin_code text not null default '',
  data jsonb,
  fetched_at timestamptz not null default now(),
  primary key (flight_number, flight_date, origin_code)
);
alter table public.flight_status_cache enable row level security;
revoke all on public.flight_status_cache from anon, authenticated;

-- Eski kayıtlar bir haftadan sonra gereksizdir.
create index flight_status_cache_fetched_idx on public.flight_status_cache (fetched_at);
