-- Seyahat asistanı: ücretsizde günde 20 mesaj, Trip Pass ve Pro'da sınırsız.
insert into public.plan_limits (plan, feature, per_trip, per_day) values
  ('free', 'trip_chat', null, 20),
  ('trip_pass', 'trip_chat', null, null),
  ('pro_monthly', 'trip_chat', null, null),
  ('pro_yearly', 'trip_chat', null, null)
on conflict do nothing;
