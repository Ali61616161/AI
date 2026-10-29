-- Seyahate nasıl gidildiği (uçak, araba, tren, otobüs, gemi); plan ve hatırlatmalar buna göre kurulur.
-- 'undecided': henüz karar verilmedi.
alter table public.trips
  add column travel_modes text[] not null default '{}'
    check (travel_modes <@ array['flight', 'car', 'train', 'bus', 'ferry', 'undecided']::text[] and cardinality(travel_modes) <= 6);

comment on column public.trips.travel_modes is 'Gidilen yere ulaşım türleri: flight, car, train, bus, ferry, undecided.';
