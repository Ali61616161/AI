-- Şema davranış testleri. scripts/test-db.sh (npm run db:test) tarafından çalıştırılır.
-- Her bölüm bir kullanıcı rolüne geçip RLS ve fonksiyonların beklendiği gibi
-- çalıştığını doğrular; herhangi bir assert başarısız olursa betik durur.

\set ON_ERROR_STOP 1
\set QUIET 1

create schema tests;
grant usage on schema tests to authenticated, anon;

-- Verilen SQL hata fırlatırsa true döner (çağıranın yetkisiyle çalışır).
create function tests.throws(p_sql text) returns boolean
language plpgsql as $$
begin
  execute p_sql;
  return false;
exception when others then
  return true;
end;
$$;
grant execute on function tests.throws(text) to authenticated, anon;

create procedure tests.login(p_user uuid)
language sql as $$ select set_config('request.jwt.claim.sub', coalesce(p_user::text, ''), false) $$;
grant execute on procedure tests.login(uuid) to authenticated, anon;

-- Assert'ler kapalıysa testler sessizce geçerdi; önce bunu doğrula.
do $$ begin
  if current_setting('plpgsql.check_asserts') <> 'on' then
    raise exception 'plpgsql.check_asserts kapalı, testler anlamsız olur';
  end if;
end $$;

-- Test kullanıcıları: Ayşe (kadın), Bea (kadın), Can (erkek).
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'ayse@example.com', '{"language": "tr", "display_name": "Ayşe"}'),
  ('00000000-0000-0000-0000-00000000000b', 'bea@example.com', '{"language": "es", "display_name": "Bea"}'),
  ('00000000-0000-0000-0000-00000000000c', 'can@example.com', '{"language": "xx"}');

update public.profiles set gender = 'female' where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');
update public.profiles set gender = 'male' where id = '00000000-0000-0000-0000-00000000000c';

\echo '1. Kayıt olunca profil oluşur, dil meta veriden alınır'
do $$ begin
  assert (select preferred_language from public.profiles where id = '00000000-0000-0000-0000-00000000000a') = 'tr';
  assert (select preferred_language from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 'en',
    'desteklenmeyen dil İngilizceye düşmeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '2. Seyahatler: sahibi üye olur, başkası göremez ve değiştiremez'
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.trips (id, title, start_date, end_date, budget_tier)
  values ('10000000-0000-0000-0000-000000000001', 'Floransa', '2026-11-01', '2026-11-05', 'low');
do $$ begin
  assert (select role from public.trip_members where trip_id = '10000000-0000-0000-0000-000000000001') = 'owner';
  assert tests.throws($q$ update public.profiles set identity_verified_at = now() $q$),
    'kullanıcı kendini doğrulanmış işaretleyememeli';
  assert tests.throws($q$ insert into public.trips (title, owner_id) values ('x', '00000000-0000-0000-0000-00000000000b') $q$),
    'başkası adına seyahat açılamamalı';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.trips (id, title) values ('10000000-0000-0000-0000-000000000002', 'Madrid');
do $$
declare n int;
begin
  assert (select count(*) from public.trips) = 1, 'Bea sadece kendi seyahatini görmeli';
  update public.trips set title = 'hack' where id = '10000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;
  assert n = 0, 'Bea Ayşe''nin seyahatini güncelleyememeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '3. Plan sürümleri: tek aktif sürüm, başkasının planına satır eklenemez'
call tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.plan_versions (id, trip_id, version, reason) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 1, 'initial'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 2, 'dates_changed');
do $$ begin
  perform public.activate_plan_version('20000000-0000-0000-0000-000000000001');
  perform public.activate_plan_version('20000000-0000-0000-0000-000000000002');
end $$;
insert into public.day_plans (id, plan_version_id, trip_id, date)
  values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '2026-11-01');
insert into public.plan_items (day_plan_id, trip_id, kind, title, priority, is_locked)
  values ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'activity', 'Uffizi', 5, true);
do $$ begin
  assert (select count(*) from public.plan_versions where is_active) = 1;
  assert (select version from public.plan_versions where is_active) = 2;
end $$;

call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert tests.throws($q$
    insert into public.day_plans (plan_version_id, trip_id, date)
    values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', '2026-11-02') $q$),
    'Bea kendi trip_id''siyle Ayşe''nin planına gün ekleyememeli';
  assert tests.throws($q$ select public.activate_plan_version('20000000-0000-0000-0000-000000000001') $q$),
    'Bea Ayşe''nin plan sürümünü değiştirememeli';
  assert (select count(*) from public.plan_items) = 0;
end $$;

-- ---------------------------------------------------------------------------
\echo '4. Limitler: ücretsizde 3 replan, Pro ile sınırsız, Trip Pass sadece kendi seyahatinde'
call tests.login('00000000-0000-0000-0000-00000000000a');
do $$
declare r record;
begin
  for i in 1..3 loop
    select * into r from public.consume_quota('replan', '10000000-0000-0000-0000-000000000001');
    assert r.allowed and r.plan = 'free' and r.remaining = 3 - i;
  end loop;
  select * into r from public.consume_quota('replan', '10000000-0000-0000-0000-000000000001');
  assert not r.allowed, '4. replan ücretsiz planda reddedilmeli';
  assert tests.throws($q$ select public.consume_quota('replan', '10000000-0000-0000-0000-000000000002') $q$),
    'üyesi olunmayan seyahat için kota kullanılamamalı';
  assert tests.throws($q$ insert into public.subscriptions (user_id, plan, status, store, product_id)
    values (auth.uid(), 'pro_yearly', 'active', 'app_store', 'x') $q$),
    'kullanıcı kendine abonelik yazamamalı';
end $$;

reset role;
insert into public.subscriptions (user_id, plan, status, store, product_id, expires_at) values
  ('00000000-0000-0000-0000-00000000000a', 'pro_yearly', 'active', 'app_store', 'yola_pro_yearly', now() + interval '1 year');
insert into public.subscriptions (user_id, plan, status, store, product_id, trip_id, expires_at) values
  ('00000000-0000-0000-0000-00000000000b', 'trip_pass', 'active', 'play_store', 'yola_trip_pass',
   '10000000-0000-0000-0000-000000000002', now() + interval '30 days');
set role authenticated;

do $$
declare r record;
begin
  select * into r from public.consume_quota('replan', '10000000-0000-0000-0000-000000000001');
  assert r.allowed and r.plan = 'pro_yearly' and r.remaining is null, 'Pro ile sınırsız olmalı';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert public.current_plan('10000000-0000-0000-0000-000000000002') = 'trip_pass';
  assert public.current_plan(null) = 'free', 'Trip Pass başka seyahatleri kapsamamalı';
end $$;

-- ---------------------------------------------------------------------------
\echo '5. Sosyal mod: rıza şartı, konum yuvarlama, kadınlara özel filtre, engelleme'
call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert tests.throws($q$ insert into public.social_profiles (user_id, is_visible) values (auth.uid(), true) $q$),
    'rıza olmadan sosyal profil açılamamalı';
end $$;

-- Üç kullanıcı da rıza verip Floransa merkezinde görünür olur.
insert into public.consents (consent, granted, version) values ('social_matching', true, '1.0'), ('location', true, '1.0');
insert into public.social_profiles (user_id, is_visible, city, approx_location, women_only)
  values (auth.uid(), true, 'Firenze', 'SRID=4326;POINT(11.255814 43.769562)', true);

call tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.consents (consent, granted, version) values ('social_matching', true, '1.0'), ('location', true, '1.0');
insert into public.social_profiles (user_id, is_visible, city, approx_location)
  values (auth.uid(), true, 'Firenze', 'SRID=4326;POINT(11.2621 43.7731)');

call tests.login('00000000-0000-0000-0000-00000000000c');
insert into public.consents (consent, granted, version) values ('social_matching', true, '1.0'), ('location', true, '1.0');
insert into public.social_profiles (user_id, is_visible, city, approx_location)
  values (auth.uid(), true, 'Firenze', 'SRID=4326;POINT(11.2500 43.7700)');

do $$ begin
  assert (select extensions.st_astext(approx_location::extensions.geometry) from public.social_profiles)
    = 'POINT(11.25 43.77)', 'konum ~1 km ızgaraya yuvarlanmalı';
  assert (select count(*) from public.social_profiles) = 1, 'başkalarının sosyal kaydı doğrudan okunamamalı';
  assert not exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000a'),
    'Can, sadece kadınlara açık Ayşe''yi görmemeli';
  assert exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000b');
end $$;

call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000b');
  assert not exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000c'),
    'kadınlara özel modda Ayşe Can''ı görmemeli';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.user_blocks (blocked_id) values ('00000000-0000-0000-0000-00000000000c');
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert not exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000b'),
    'engelleyen kullanıcı görünmemeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '6. Davetler ve mesajlar: günlük limit, kabul öncesi mesaj yok, üçüncü kişi okuyamaz'
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare v_invite uuid;
begin
  -- Engelleme testi kota kullanılmadan önce yapılır; aksi halde kota dolduğu
  -- için de hata alınır ve test engellemeyi doğrulamamış olur.
  assert tests.throws($q$ select public.send_invite('00000000-0000-0000-0000-00000000000c', 'p', 'x', 11.25, 43.77,
                                 now() + interval '1 day') $q$),
    'engellenen kullanıcıya davet gönderilememeli';
  assert not exists (select 1 from public.usage_events where feature = 'social_invite'),
    'reddedilen davet kotadan düşmemeli';
  -- Bea'nın Trip Pass'i bu seyahate bağlı değil; davetler için ücretsiz plan geçerli (günde 1).
  v_invite := public.send_invite('00000000-0000-0000-0000-00000000000a', 'ChIJ_uffizi', 'Caffè Gilli',
                                 11.2546, 43.7714, now() + interval '1 day', 'Kahve?');
  assert v_invite is not null;
  assert tests.throws($q$ select public.send_invite('00000000-0000-0000-0000-00000000000a', 'p', 'x', 11.25, 43.77,
                                 now() + interval '1 day') $q$),
    'ücretsiz planda günde ikinci davet reddedilmeli';
  assert tests.throws(format($q$ insert into public.messages (invite_id, body) values (%L, 'selam') $q$, v_invite)),
    'davet kabul edilmeden mesaj yazılamamalı';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000a');
do $$
declare v_invite uuid := (select id from public.match_invites limit 1);
begin
  assert tests.throws(format($q$ select public.respond_invite(%L, 'cancelled') $q$, v_invite)),
    'alıcı daveti iptal edemez, sadece kabul/ret';
  perform public.respond_invite(v_invite, 'accepted');
  insert into public.messages (invite_id, body) values (v_invite, 'Görüşürüz!');
end $$;

call tests.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (select count(*) from public.match_invites) = 0;
  assert (select count(*) from public.messages) = 0, 'üçüncü kişi mesajları okuyamamalı';
end $$;

-- ---------------------------------------------------------------------------
\echo '7. Storage: herkes sadece kendi klasörüne yükler'
call tests.login('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-00000000000a/ticket.pdf');
do $$ begin
  assert tests.throws($q$ insert into storage.objects (bucket_id, name)
    values ('documents', '00000000-0000-0000-0000-00000000000b/ticket.pdf') $q$),
    'başkasının klasörüne dosya yüklenememeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '8. Giriş yapmamış kullanıcı (anon) korumalı fonksiyonları çağıramaz'
set role anon;
call tests.login(null);
do $$ begin
  assert tests.throws($q$ select public.consume_quota('replan') $q$);
  assert tests.throws($q$ select * from public.nearby_travelers() $q$);
  assert (select count(*) from public.plan_limits) > 0, 'limitler herkese açık olmalı (fiyat ekranı için)';
end $$;

-- ---------------------------------------------------------------------------
\echo '9. Belgelerden seyahat: tek işlem, mevcut seyahate ekleme, başkasının belgesi reddedilir'
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.documents (id, storage_path, mime_type, status) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b/flight.pdf', 'application/pdf', 'parsed'),
  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-00000000000b/hotel.png', 'image/png', 'parsed'),
  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-00000000000b/return.pdf', 'application/pdf', 'parsed');

do $$
declare
  v_trip uuid;
  v_trips_before int := (select count(*) from public.trips);
begin
  v_trip := public.create_trip_from_documents(
    '{"title": "Rome · Florence", "start_date": "2026-11-01", "end_date": "2026-11-04", "budget_tier": "low", "interests": ["art", "food"]}',
    '[{"city": "Rome", "country_code": "IT", "arrive_on": "2026-11-01", "depart_on": "2026-11-02"},
      {"city": "Florence", "country_code": "IT", "arrive_on": "2026-11-02", "depart_on": "2026-11-04"}]',
    '[{"document_id": "40000000-0000-0000-0000-000000000001", "type": "flight", "title": "TK1865 IST → FCO",
       "starts_at": "2026-11-01T05:10:00Z", "ends_at": "2026-11-01T08:45:00Z", "origin_code": "IST", "destination_code": "FCO",
       "details": {"seat": "14C"}},
      {"document_id": "40000000-0000-0000-0000-000000000002", "type": "hotel", "title": "Hotel Santa Maria Novella",
       "starts_at": "2026-11-02T14:00:00Z", "ends_at": "2026-11-04T10:00:00Z", "details": {"breakfast_included": true}}]',
    array['40000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002']::uuid[]
  );
  assert (select title from public.trips where id = v_trip) = 'Rome · Florence';
  assert (select status from public.trips where id = v_trip) = 'planned';
  assert (select interests from public.trips where id = v_trip) = '{art,food}';
  assert (select count(*) from public.trip_destinations where trip_id = v_trip) = 2;
  assert (select count(*) from public.reservations where trip_id = v_trip) = 2;
  assert (select details ->> 'seat' from public.reservations where trip_id = v_trip and type = 'flight') = '14C';
  assert (select count(*) from public.documents where trip_id = v_trip and status = 'confirmed') = 2;

  -- Dönüş uçuşunu sonradan aynı seyahate ekle: bitiş tarihi uzar, Floransa tekrar eklenmez.
  perform public.create_trip_from_documents(
    '{"start_date": "2026-11-05", "end_date": "2026-11-05"}',
    '[{"city": "florence", "arrive_on": "2026-11-02"}]',
    '[{"document_id": "40000000-0000-0000-0000-000000000003", "type": "flight", "title": "TK1866 FLR → IST",
       "starts_at": "2026-11-05T16:00:00Z"}]',
    array['40000000-0000-0000-0000-000000000003']::uuid[],
    v_trip
  );
  assert (select end_date from public.trips where id = v_trip) = '2026-11-05';
  assert (select start_date from public.trips where id = v_trip) = '2026-11-01', 'başlangıç tarihi daralmamalı';
  assert (select count(*) from public.trip_destinations where trip_id = v_trip) = 2;
  assert (select count(*) from public.reservations where trip_id = v_trip) = 3;
  assert (select count(*) from public.trips) = v_trips_before + 1, 'eklemede yeni seyahat açılmamalı';

  -- Rezervasyonsuz çağrı reddedilir.
  assert tests.throws($q$ select public.create_trip_from_documents('{}', '[]', '[]', '{}') $q$);
end $$;

-- Ayşe'nin bir belgesi (sahibi Ayşe, Bea göremez).
reset role;
insert into public.documents (id, user_id, storage_path, mime_type, status) values
  ('40000000-0000-0000-0000-0000000000aa', '00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000a/x.pdf', 'application/pdf', 'parsed');
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000b');

do $$
declare v_before int := (select count(*) from public.trips);
begin
  assert tests.throws($q$ select public.create_trip_from_documents(
    '{"title": "Hack"}', '[]',
    '[{"type": "other", "title": "x", "starts_at": "2026-11-01T00:00:00Z"}]',
    array['40000000-0000-0000-0000-0000000000aa']::uuid[]) $q$),
    'başkasının belgesiyle seyahat oluşturulamamalı';
  assert (select count(*) from public.trips) = v_before, 'başarısız işlem hiçbir şey bırakmamalı';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000c');
do $$
declare v_trip uuid;
begin
  reset role;
  select id into v_trip from public.trips where title = 'Rome · Florence';
  set role authenticated;
  assert tests.throws(format($q$ select public.create_trip_from_documents('{}', '[]',
    '[{"type": "other", "title": "x", "starts_at": "2026-11-01T00:00:00Z"}]', '{}', %L) $q$, v_trip)),
    'Can, Bea''nın seyahatine ekleme yapamamalı';
end $$;

-- ---------------------------------------------------------------------------
\echo '10. Plan sürümleri: AI planı tek işlemde kaydedilir, yeni sürüm aktif olur'
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare
  v_trip uuid := (select id from public.trips where title = 'Rome · Florence');
  v_flight uuid := (select id from public.reservations where trip_id = (select id from public.trips where title = 'Rome · Florence') and title = 'TK1865 IST → FCO');
  v_foreign uuid;
  v1 uuid;
  v2 uuid;
begin
  -- Bea'nın başka bir seyahatine (Madrid) ait rezervasyon.
  insert into public.reservations (trip_id, type, title, starts_at)
    values ('10000000-0000-0000-0000-000000000002', 'event', 'Madrid konseri', '2026-12-01T20:00:00Z')
    returning id into v_foreign;

  v1 := public.save_plan_version(v_trip, 'initial', format($j$[
    {"date": "2026-11-01", "city": "Rome", "title": "Varış", "items": [
      {"kind": "transport", "title": "TK1865", "starts_at": "2026-11-01T05:10:00Z", "timezone": "Europe/Istanbul",
       "is_locked": true, "priority": 5, "reservation_id": "%s"},
      {"kind": "activity", "title": "Trevi", "starts_at": "2026-11-01T15:00:00Z", "ends_at": "2026-11-01T16:00:00Z",
       "timezone": "Europe/Rome", "is_indoor": false, "category": "history", "estimated_cost": 0, "cost_currency": "EUR",
       "affiliate_partner": "getyourguide", "reservation_id": "%s"}
    ]},
    {"date": "2026-11-02", "city": "Rome", "items": []}
  ]$j$, v_flight, v_foreign)::jsonb, 'İlk plan');

  assert (select version from public.plan_versions where id = v1) = 1;
  assert (select is_active from public.plan_versions where id = v1);
  assert (select count(*) from public.day_plans where plan_version_id = v1) = 2;
  assert (select count(*) from public.plan_items i join public.day_plans d on d.id = i.day_plan_id where d.plan_version_id = v1) = 2;
  assert (select reservation_id from public.plan_items where title = 'TK1865') = v_flight;
  assert (select reservation_id from public.plan_items where title = 'Trevi') is null, 'başka seyahatin rezervasyonu bağlanmamalı';
  assert (select timezone = 'Europe/Rome' and is_indoor = false and category = 'history' and affiliate_partner = 'getyourguide'
          from public.plan_items where title = 'Trevi');
  assert (select trip_id from public.plan_items where title = 'Trevi') = v_trip;

  v2 := public.save_plan_version(v_trip, 'replan', '[{"date": "2026-11-01", "items": [{"kind": "meal", "title": "Pizza", "starts_at": "2026-11-01T18:00:00Z"}]}]', null, 'Yağmur başladı');
  assert (select version from public.plan_versions where id = v2) = 2;
  assert (select count(*) from public.plan_versions where trip_id = v_trip and is_active) = 1;
  assert (select is_active from public.plan_versions where id = v2);
  assert (select user_prompt from public.plan_versions where id = v2) = 'Yağmur başladı';
  assert (select count(*) from public.plan_items where title = 'Trevi') = 1, 'eski sürümün verisi korunmalı';

  assert tests.throws(format($q$ select public.save_plan_version(%L, 'initial', '[]') $q$, v_trip)), 'boş plan reddedilmeli';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000c');
do $$
declare v_trip uuid;
begin
  reset role;
  select id into v_trip from public.trips where title = 'Rome · Florence';
  set role authenticated;
  assert tests.throws(format($q$ select public.save_plan_version(%L, 'initial',
    '[{"date": "2026-11-01", "items": []}]') $q$, v_trip)), 'Can, Bea''nın seyahatine plan yazamamalı';
end $$;

-- ---------------------------------------------------------------------------
\echo '11. Tarih değişikliği ve eski sürüme dönüş: tarihler planla birlikte değişir ve geri gelir'
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare
  v_trip uuid := (select id from public.trips where title = 'Rome · Florence');
  v_before uuid := (select id from public.plan_versions where trip_id = (select id from public.trips where title = 'Rome · Florence') and is_active);
  v_new uuid;
begin
  assert (select (start_date, end_date) = ('2026-11-01'::date, '2026-11-05'::date) from public.trips where id = v_trip);
  assert (select trip_end_date from public.plan_versions where id = v_before) = '2026-11-05', 'sürüm kaydedildiği andaki tarihleri saklamalı';

  -- Seyahati 3 güne kısalt.
  v_new := public.apply_trip_dates(v_trip, '2026-11-01', '2026-11-03',
    '[{"date": "2026-11-01", "items": [{"kind": "activity", "title": "Kolezyum", "starts_at": "2026-11-01T10:00:00Z", "priority": 5}]}]',
    'Seyahat 3 güne kısaldı');
  assert (select (start_date, end_date) = ('2026-11-01'::date, '2026-11-03'::date) from public.trips where id = v_trip);
  assert (select reason from public.plan_versions where id = v_new) = 'dates_changed';
  assert (select is_active from public.plan_versions where id = v_new);
  assert (select (trip_start_date, trip_end_date) = ('2026-11-01'::date, '2026-11-03'::date) from public.plan_versions where id = v_new);
  assert (select user_prompt from public.plan_versions where id = v_new) = '2026-11-01 → 2026-11-03';
  -- Floransa durağı (2–4 Kasım) yeni bitişe (3 Kasım) kısalır.
  assert (select depart_on from public.trip_destinations where trip_id = v_trip and city = 'Florence') = '2026-11-03';
  assert (select count(*) from public.reservations where trip_id = v_trip) = 3, 'rezervasyonlar silinmemeli';

  -- Eski plana dön: tarihler de geri gelir.
  perform public.restore_plan_version(v_before);
  assert (select is_active from public.plan_versions where id = v_before);
  assert not (select is_active from public.plan_versions where id = v_new);
  assert (select (start_date, end_date) = ('2026-11-01'::date, '2026-11-05'::date) from public.trips where id = v_trip);

  assert tests.throws(format($q$ select public.apply_trip_dates(%L, '2026-11-05', '2026-11-01', '[{"date": "2026-11-05", "items": []}]') $q$, v_trip)),
    'bitiş başlangıçtan önce olamaz';

  -- Rotası olmayan seyahatte sadece tarihler değişir.
  assert public.apply_trip_dates('10000000-0000-0000-0000-000000000002', '2026-12-01', '2026-12-04', '[]') is null;
  assert (select end_date from public.trips where id = '10000000-0000-0000-0000-000000000002') = '2026-12-04';
end $$;

call tests.login('00000000-0000-0000-0000-00000000000c');
do $$
declare v_trip uuid; v_version uuid;
begin
  reset role;
  select id into v_trip from public.trips where title = 'Rome · Florence';
  select id into v_version from public.plan_versions where trip_id = v_trip and not is_active limit 1;
  set role authenticated;
  assert tests.throws(format($q$ select public.apply_trip_dates(%L, '2026-11-01', '2026-11-02', '[{"date": "2026-11-01", "items": []}]') $q$, v_trip)),
    'Can, Bea''nın seyahatinin tarihlerini değiştirememeli';
  assert tests.throws(format($q$ select public.restore_plan_version(%L) $q$, v_version)),
    'Can, Bea''nın planını geri alamamalı';
end $$;

-- ---------------------------------------------------------------------------
\echo '12. Mekan bilgileri plana kaydedilir; yakın arama kotası günde 10'
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare v_trip uuid; v_plan uuid; r record; i integer;
begin
  select id into v_trip from public.trips where title = 'Rome · Florence';
  v_plan := public.save_plan_version(v_trip, 'manual_edit', $j$[{"date": "2026-11-01", "city": "Roma", "items": [
    {"kind": "activity", "title": "Vatikan", "place_name": "Musei Vaticani", "google_place_id": "ChIJvat",
     "lat": 41.9065, "lng": 12.4536, "rating": 4.6, "rating_count": 120000, "place_status": "OPERATIONAL",
     "maps_url": "https://maps.google.com/?cid=1", "booking_url": "https://www.tiqets.com/en/search/?q=vat",
     "affiliate_partner": "tiqets", "place_checked_at": "2026-10-11T10:00:00Z"},
    {"kind": "meal", "title": "Kötü bağlantılar", "maps_url": "javascript:alert(1)", "booking_url": "http://x.test",
     "lat": 999, "lng": 12}
  ]}]$j$::jsonb);
  select * into r from public.plan_items where trip_id = v_trip and title = 'Vatikan'
    and day_plan_id in (select id from public.day_plans where plan_version_id = v_plan);
  assert r.google_place_id = 'ChIJvat' and r.rating = 4.6 and r.rating_count = 120000;
  assert round(r.lat::numeric, 4) = 41.9065 and round(r.lng::numeric, 4) = 12.4536, 'koordinatlar location sütunundan okunmalı';
  assert r.maps_url = 'https://maps.google.com/?cid=1' and r.booking_url like 'https://www.tiqets.com/%';
  assert r.place_checked_at = '2026-10-11T10:00:00Z' and r.place_status = 'OPERATIONAL';
  select * into r from public.plan_items where title = 'Kötü bağlantılar' and day_plan_id in (select id from public.day_plans where plan_version_id = v_plan);
  assert r.maps_url is null and r.booking_url is null, 'https olmayan bağlantılar kaydedilmemeli';
  assert r.location is null and r.lat is null, 'geçersiz koordinat kaydedilmemeli';

  for i in 1..10 loop
    select * into r from public.consume_quota('nearby_search');
    assert r.allowed, format('%s. arama izinli olmalı', i);
  end loop;
  select * into r from public.consume_quota('nearby_search');
  assert not r.allowed and r.remaining = 0, '11. yakın arama reddedilmeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '13. Çeviri kotası: metin 20/gün, konuşma 300 saniye/gün (miktarla)'
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare r record; s record; i integer;
begin
  select * into r from public.consume_quota('voice_translation', null, 250);
  assert r.allowed and r.remaining = 50, '250 saniye izinli, 50 kalmalı';
  select * into r from public.consume_quota('voice_translation', null, 60);
  assert not r.allowed and r.remaining = 50, '60 saniye kalan 50 saniyeyi aşar';
  select * into r from public.consume_quota('voice_translation', null, 50);
  assert r.allowed and r.remaining = 0;
  assert tests.throws($q$ select public.consume_quota('voice_translation', null, 0) $q$), 'sıfır miktar reddedilmeli';
  select * into s from public.quota_status('voice_translation');
  assert s.plan = 'free' and s.per_day = 300 and s.used_today = 300;
  for i in 1..20 loop
    select * into r from public.consume_quota('text_translation');
    assert r.allowed;
  end loop;
  select * into r from public.consume_quota('text_translation');
  assert not r.allowed, '21. metin çevirisi reddedilmeli';
end $$;
reset role;
do $$ begin
  assert (select count(*) from public.usage_events where feature = 'voice_translation') = 2, 'reddedilen istek kaydedilmemeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '14. Hesap silinince tüm veri silinir (KVKK/GDPR)'
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert not exists (select 1 from public.trips where owner_id = '00000000-0000-0000-0000-00000000000a');
  assert not exists (select 1 from public.plan_items where trip_id = '10000000-0000-0000-0000-000000000001');
  assert exists (select 1 from public.plan_items where title = 'Trevi'), 'başka kullanıcının verisi silinmemeli';
  assert not exists (select 1 from public.match_invites);
  assert not exists (select 1 from public.consents where user_id = '00000000-0000-0000-0000-00000000000a');
end $$;

\echo 'Tüm şema testleri geçti.'
