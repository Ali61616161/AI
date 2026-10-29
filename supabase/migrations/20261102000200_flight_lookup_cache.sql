-- Uçuş numarası + tarih ile uçuş bilgisi arama önbelleği (seyahat oluştururken havalimanları ve saatler otomatik dolar).
-- İstemci okuyamaz/yazamaz (politika yok); yalnızca flight-status Edge Function'ı (service_role) kullanır.
create table public.flight_lookup_cache (
  flight_number text not null check (flight_number ~ '^[A-Z0-9]{2}[0-9]{1,4}[A-Z]?$'),
  flight_date date not null,
  data jsonb,
  fetched_at timestamptz not null default now(),
  primary key (flight_number, flight_date)
);
alter table public.flight_lookup_cache enable row level security;
revoke all on public.flight_lookup_cache from anon, authenticated;
create index flight_lookup_cache_fetched_idx on public.flight_lookup_cache (fetched_at);
