-- Şehir araması (seyahat kurarken yazdıkça öneri): ücretsizde günde 80, ücretli planlarda 400 (maliyet koruması).
insert into public.plan_limits (plan, feature, per_trip, per_day) values
  ('free', 'city_search', null, 80),
  ('trip_pass', 'city_search', null, 400),
  ('pro_monthly', 'city_search', null, 400),
  ('pro_yearly', 'city_search', null, 400)
on conflict do nothing;
