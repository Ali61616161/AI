-- Mekân kartı açılışları: Google Places ayrıntı + fotoğraf istekleri ücretli olduğu için günlük sınır.
insert into public.plan_limits (plan, feature, per_trip, per_day, per_week) values
  ('free', 'place_details', null, 20, null),
  ('trip_pass', 'place_details', null, 150, null),
  ('pro_monthly', 'place_details', null, 150, null),
  ('pro_yearly', 'place_details', null, 150, null)
on conflict (plan, feature) do update set per_day = excluded.per_day, per_trip = excluded.per_trip, per_week = excluded.per_week;
