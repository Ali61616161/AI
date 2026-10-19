-- Seyahate varış/dönüş saati ve havalimanı (isteğe bağlı): plan, inişten sonraki ve uçuştan önceki
-- süreyi hesaba katar. Saatler gidilen ülkenin yerel saatidir.
alter table public.trips
  add column arrival_time time,
  add column departure_time time,
  add column arrival_airport text check (arrival_airport is null or char_length(arrival_airport) <= 120),
  add column departure_airport text check (departure_airport is null or char_length(departure_airport) <= 120);

comment on column public.trips.arrival_time is 'Gidilen ülkeye iniş saati (yerel); ilk günün planı bundan sonra başlar.';
comment on column public.trips.departure_time is 'Dönüş uçuşunun kalkış saati (yerel); son günün planı havalimanına yetişecek şekilde biter.';
