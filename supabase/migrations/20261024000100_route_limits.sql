-- "Nasıl giderim?" güzergah sorguları: Google Routes API ücretli olduğu için günlük sınır.
insert into public.plan_limits (plan, feature, per_trip, per_day, per_week) values
  ('free', 'route', null, 15, null),
  ('trip_pass', 'route', null, 100, null),
  ('pro_monthly', 'route', null, 100, null),
  ('pro_yearly', 'route', null, 100, null)
on conflict (plan, feature) do update set per_day = excluded.per_day, per_trip = excluded.per_trip, per_week = excluded.per_week;
