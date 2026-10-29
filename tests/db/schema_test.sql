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

-- Sosyal mod için görünen ad ve 18+ yaş.
update public.profiles set birth_year = 1990, display_name = coalesce(display_name, 'Test');

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
\echo '5. Sosyal mod: rıza şartı, konum yuvarlama, engelleme'
call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert tests.throws($q$ insert into public.social_profiles (user_id, is_visible) values (auth.uid(), true) $q$),
    'rıza olmadan sosyal profil açılamamalı';
end $$;

-- Üç kullanıcı da rıza verip Floransa merkezinde görünür olur.
insert into public.consents (consent, granted, version) values ('social_matching', true, '1.0'), ('location', true, '1.0');
insert into public.social_profiles (user_id, is_visible, city, approx_location)
  values (auth.uid(), true, 'Firenze', 'SRID=4326;POINT(11.255814 43.769562)');

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
  assert exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000a');
  assert exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000b');
end $$;

call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000b');
  assert exists (select 1 from public.nearby_travelers() where user_id = '00000000-0000-0000-0000-00000000000c');
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
reset role;
-- Mekân, "şu an açık" aramasında sunucu tarafından doğrulanmış olmalı.
insert into public.verified_places (google_place_id, name, location)
  values ('ChIJ_uffizi', 'Caffè Gilli', extensions.st_setsrid(extensions.st_makepoint(11.2546, 43.7714), 4326)::extensions.geography);
set role authenticated;
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
  assert tests.throws($q$ select public.send_invite('00000000-0000-0000-0000-00000000000a', 'ChIJ_private_home', 'Starbucks',
                                 11.25, 43.77, now() + interval '1 day') $q$),
    'doğrulanmamış mekâna davet gönderilememeli';
  -- İstemcinin gönderdiği ad ve konum yok sayılır; doğrulanmış kayıt kullanılır.
  v_invite := public.send_invite('00000000-0000-0000-0000-00000000000a', 'ChIJ_uffizi', 'Sahte Ad',
                                 29.0, 41.0, now() + interval '1 day', 'Kahve?');
  assert v_invite is not null;
  assert (select place_name from public.match_invites where id = v_invite) = 'Caffè Gilli', 'mekân adı sunucunun kaydından gelir';
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
\echo '14. Harcama ve hesap bölüşme: paylar kuruşu kuruşuna, yetkisiz kullanıcı ekleyemez'
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare v_trip uuid; v_id uuid;
begin
  select id into v_trip from public.trips where title = 'Rome · Florence';
  v_id := public.add_expense(v_trip, 100, 'eur', 100, 'food', ' Akşam yemeği ', 'Bea', array['Bea', 'Ali', 'Can', '', 'Ali']);
  assert (select currency from public.expenses where id = v_id) = 'EUR';
  assert (select description from public.expenses where id = v_id) = 'Akşam yemeği';
  assert (select count(*) from public.expense_shares where expense_id = v_id) = 3, 'boş ve tekrar eden isimler atılmalı';
  assert (select sum(share_amount) from public.expense_shares where expense_id = v_id) = 100, 'paylar toplamı tutara eşit olmalı';
  assert (select max(share_amount) - min(share_amount) from public.expense_shares where expense_id = v_id) = 0.01;
  -- Bütçe para birimine çevrilmiş tutar paylaştırılır.
  v_id := public.add_expense(v_trip, 3000, 'JPY', 18.5, 'transport', null, 'Ali', array['Bea', 'Ali']);
  assert (select sum(share_amount) from public.expense_shares where expense_id = v_id) = 18.5;
  -- Bölüşülmeyen harcama.
  v_id := public.add_expense(v_trip, 12, 'EUR', 12, 'other', null, 'Bea');
  assert not exists (select 1 from public.expense_shares where expense_id = v_id);
  assert tests.throws(format($q$ select public.add_expense(%L, 0, 'EUR', 0, 'food', null, 'Bea') $q$, v_trip)), 'sıfır tutar reddedilmeli';
end $$;
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$
declare v_trip uuid;
begin
  reset role;
  select id into v_trip from public.trips where title = 'Rome · Florence';
  set role authenticated;
  assert tests.throws(format($q$ select public.add_expense(%L, 10, 'EUR', 10, 'food', null, 'Can') $q$, v_trip)), 'Can, Bea''nın seyahatine harcama ekleyememeli';
  assert (select count(*) from public.expenses where trip_id = v_trip) = 0, 'Can başkasının harcamalarını görememeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '15. Sosyal güvenlik: 18 yaş, engelleyince davet iptali, davet listesi'
reset role;
insert into public.consents (user_id, consent, granted, version) values
  ('00000000-0000-0000-0000-00000000000c', 'social_matching', true, 't'), ('00000000-0000-0000-0000-00000000000c', 'location', true, 't');
update public.profiles set birth_year = extract(year from now())::int - 16, display_name = 'Can' where id = '00000000-0000-0000-0000-00000000000c';
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert tests.throws($q$ insert into public.social_profiles (user_id, is_visible, approx_location) values (auth.uid(), true, 'SRID=4326;POINT(12.49 41.89)') $q$),
    '18 yaş altı görünür olamaz';
end $$;
reset role;
update public.profiles set birth_year = 1995 where id = '00000000-0000-0000-0000-00000000000c';
-- Davet listesi ve engelleme: Can → Ayşe bekleyen davet.
reset role;
insert into public.match_invites (id, from_user, to_user, google_place_id, place_name, place_location, meet_at)
values ('90000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000c', '00000000-0000-0000-0000-00000000000a', 'p', 'Caffè', 'SRID=4326;POINT(12.48 41.9)', now() + interval '1 day');
call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ declare r record; begin
  select * into r from public.my_invites() where id = '90000000-0000-0000-0000-000000000001';
  assert r.incoming and r.other_name = 'Can' and r.place_name = 'Caffè', 'davet listesinde karşı tarafın adı görünmeli';
  assert round(r.place_lat::numeric, 1) = 41.9;
  insert into public.user_blocks (blocked_id) values ('00000000-0000-0000-0000-00000000000c');
  assert not exists (select 1 from public.my_invites() where id = '90000000-0000-0000-0000-000000000001'), 'engellenen kişinin daveti listelenmemeli';
end $$;
reset role;
do $$ begin
  assert (select status from public.match_invites where id = '90000000-0000-0000-0000-000000000001') = 'cancelled', 'engelleyince davet iptal olmalı';
end $$;

-- ---------------------------------------------------------------------------
\echo '16. Yetki sıkılaştırma: üye satırı taşınamaz, sahip değişmez, doğum yılı kilitli, https bağlantılar, kotalar'
reset role;
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000c');
insert into public.trips (id, title) values ('10000000-0000-0000-0000-0000000000c1', 'Can trip');
do $$
declare r record; i integer;
begin
  assert tests.throws($q$ update public.trip_members set trip_id = '10000000-0000-0000-0000-000000000001', role = 'editor'
    where trip_id = '10000000-0000-0000-0000-0000000000c1' $q$), 'üye satırı başka seyahate taşınamamalı';
  assert tests.throws($q$ update public.trips set owner_id = '00000000-0000-0000-0000-00000000000b'
    where id = '10000000-0000-0000-0000-0000000000c1' $q$), 'seyahat sahibi değiştirilememeli';
  update public.trips set title = 'Can trip 2' where id = '10000000-0000-0000-0000-0000000000c1';
  assert tests.throws($q$ update public.profiles set birth_year = 2001 where id = auth.uid() $q$), 'doğum yılı sonradan değiştirilememeli';
  update public.profiles set bio = 'merhaba', birth_year = 1995 where id = auth.uid();
  assert tests.throws($q$ update public.profiles set avatar_url = 'https://evil.test/pixel.png' where id = auth.uid() $q$), 'dış adresten profil fotoğrafı olmamalı';

  for i in 1..40 loop
    select * into r from public.consume_quota('weather');
    assert r.allowed, format('%s. hava durumu izinli olmalı', i);
  end loop;
  select * into r from public.consume_quota('weather');
  assert not r.allowed, '41. hava durumu isteği reddedilmeli';
  for i in 1..3 loop
    select * into r from public.consume_quota('trip_report', '10000000-0000-0000-0000-0000000000c1');
    assert r.allowed;
  end loop;
  select * into r from public.consume_quota('trip_report', '10000000-0000-0000-0000-0000000000c1');
  assert not r.allowed, 'ücretsizde seyahat başına 3 AI raporu';
end $$;
reset role;
do $$ begin
  assert tests.throws($q$ update public.plan_items set booking_url = 'javascript:alert(1)' where title = 'Trevi' $q$), 'https olmayan bilet bağlantısı reddedilmeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '17. v1.1: vatandaşlık ve vizeler, kayıtlı/gidilen yerler, haftalık kota, bağış Pro'
reset role;
-- Bea'ya bağış (süresiz) Pro verilir.
insert into public.subscriptions (user_id, plan, status, store, product_id, original_transaction_id, expires_at)
values ('00000000-0000-0000-0000-00000000000b', 'pro_yearly', 'active', 'promotional', 'yola_complimentary', 'complimentary:b', null);
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$
declare r record; i integer; s record;
begin
  update public.profiles set passport_country = 'TR', other_passports = '{DE}', extra_visas = '{schengen_visa,us_visa}',
    home_city = 'İstanbul', home_country = 'TR', home_lat = 41.01, home_lng = 28.98 where id = auth.uid();
  assert tests.throws($q$ update public.profiles set extra_visas = '{fake_visa}' where id = auth.uid() $q$), 'bilinmeyen vize türü reddedilmeli';
  assert tests.throws($q$ update public.profiles set other_passports = '{tr}' where id = auth.uid() $q$), 'ülke kodu büyük harf 2 karakter olmalı';
  assert tests.throws($q$ update public.profiles set other_passports = '{DE,FR,IT,ES}' where id = auth.uid() $q$), 'en fazla 3 ek pasaport';
  assert tests.throws($q$ update public.profiles set home_lat = 41.0123 where id = auth.uid() $q$) or
    (select home_lat from public.profiles where id = auth.uid()) = 41.01, 'şehir konumu ~1 km hassasiyette saklanmalı';

  -- Ücretsiz: tek liste, başka liste adı Pro ister.
  insert into public.saved_places (google_place_id, name) values ('p1', 'Kafe');
  assert tests.throws($q$ insert into public.saved_places (list_name, google_place_id, name) values ('date', 'p2', 'Restoran') $q$), 'ücretsizde ek liste olmamalı';
  assert tests.throws($q$ insert into public.saved_places (user_id, google_place_id, name) values ('00000000-0000-0000-0000-00000000000b', 'p3', 'X') $q$), 'başkası adına kayıt olmamalı';

  -- Şehir pasaportu: bu hafta ve geçen hafta → seri 2.
  insert into public.place_visits (google_place_id, name, category, visited_on) values
    ('p1', 'Kafe', 'cafe', current_date), ('p9', 'Park', 'park', current_date - 7), ('p1', 'Kafe', 'cafe', current_date - 21);
  select * into s from public.city_passport_stats();
  assert s.places = 2 and s.visits = 3 and s.categories = 2, format('istatistik yanlış: %s', s);
  assert s.week_streak = 2, format('seri 2 olmalı, %s', s.week_streak);
  assert tests.throws($q$ insert into public.place_visits (google_place_id, name, visited_on) values ('p5', 'Gelecek', current_date + 5) $q$), 'gelecek tarihli ziyaret olmamalı';

  -- Haftalık kota: Şehrim planı haftada 1; çark günde 1.
  select * into r from public.consume_quota('city_plan');
  assert r.allowed and r.remaining = 0;
  select * into r from public.consume_quota('city_plan');
  assert not r.allowed, 'ücretsizde haftada 1 şehir planı';
  select * into r from public.quota_status('city_plan');
  assert r.per_week = 1 and r.used_week = 1;
  select * into r from public.consume_quota('spin');
  assert r.allowed;
  select * into r from public.consume_quota('spin');
  assert not r.allowed, 'ücretsizde günde 1 çark';
end $$;

-- Bea (bağış Pro): sınırsız çark ve ek listeler.
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare r record; i integer;
begin
  assert public.current_plan() = 'pro_yearly', 'bağış Pro geçerli olmalı';
  for i in 1..5 loop
    select * into r from public.consume_quota('spin');
    assert r.allowed, 'Pro sınırsız çark';
  end loop;
  insert into public.saved_places (list_name, google_place_id, name) values ('date', 'p2', 'Restoran');
  assert (select count(*) from public.saved_places) = 1, 'herkes sadece kendi kayıtlı yerlerini görür';
end $$;
reset role;
do $$ begin
  assert public.grant_ad_reward('00000000-0000-0000-0000-00000000000c', 'spin', 'tx-spin-1') = 'granted', 'çark ödüllü reklamla açılabilmeli';
end $$;

-- ---------------------------------------------------------------------------
\echo '18. Gezdiğim ülkeler, belgeler, Schengen kalışları: sadece sahibi görür'
reset role;
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$
begin
  insert into public.visited_countries (country_code) values ('GE'), ('JP');
  assert tests.throws($q$ insert into public.visited_countries (country_code) values ('ge') $q$), 'ülke kodu büyük harf';
  insert into public.travel_documents (kind, country_code, expires_on) values ('passport', 'TR', current_date + 100);
  assert tests.throws($q$ insert into public.travel_documents (kind, expires_on) values ('credit_card', current_date) $q$), 'bilinmeyen belge türü';
  insert into public.schengen_stays (entry_on, exit_on) values (current_date - 20, current_date - 10);
  assert tests.throws($q$ insert into public.schengen_stays (entry_on, exit_on) values (current_date, current_date - 1) $q$), 'çıkış girişten önce olamaz';
  assert public.visited_percentile() is null, '1000 kullanıcıdan az veriyle yüzde gösterilmez';
end $$;
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.visited_countries) = 0, 'başkasının ülkeleri görünmemeli';
  assert (select count(*) from public.travel_documents) = 0, 'başkasının belgeleri görünmemeli';
  assert (select count(*) from public.schengen_stays) = 0, 'başkasının kalışları görünmemeli';
  assert tests.throws($q$ insert into public.visited_countries (user_id, country_code) values ('00000000-0000-0000-0000-00000000000c', 'FR') $q$), 'başkası adına eklenemez';
end $$;

-- ---------------------------------------------------------------------------
\echo '18b. Arkadaşını davet et: kod, tek kullanım, ikisine 7 gün Pro'
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$
declare v_code text;
begin
  v_code := public.my_referral_code('device-of-b-123');
  assert v_code ~ '^[A-HJ-NP-Z2-9]{6}$', 'kod 6 karakter, karışan harf yok';
  assert public.my_referral_code() = v_code, 'kod sabit kalmalı';
  assert (public.redeem_referral(v_code, 'device-of-b-123') ->> 'reason') = 'own_code', 'kendi kodu kullanılamaz';
  assert tests.throws($q$ update public.profiles set referral_code = 'AAAAAA' where id = auth.uid() $q$), 'kod elle değiştirilemez';
  perform set_config('tests.code', v_code, false);
end $$;
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert (public.redeem_referral(current_setting('tests.code')) ->> 'reason') = 'device_required', 'cihaz kimliği şart';
  assert (public.redeem_referral(current_setting('tests.code'), 'device-of-b-123') ->> 'reason') = 'own_code', 'davet edenin cihazındaki ikinci hesap kullanamaz';
  assert (public.redeem_referral('ZZZZZZ', 'device-of-c-456') ->> 'reason') = 'invalid_code', 'olmayan kod';
  assert (public.redeem_referral(lower(current_setting('tests.code')), 'device-of-c-456') ->> 'ok')::boolean, 'küçük harfle de çalışır';
  assert (public.redeem_referral(current_setting('tests.code'), 'device-of-c-456') ->> 'reason') = 'already_redeemed', 'ikinci kez kullanılamaz';
  assert public.current_plan() = 'pro_monthly', 'davet edilene 7 gün Pro';
  assert tests.throws($q$ insert into public.referrals (referred_id, referrer_id) values (auth.uid(), auth.uid()) $q$), 'doğrudan eklenemez';
end $$;
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert not exists (select 1 from public.subscriptions where user_id = auth.uid() and product_id = 'yola_referral'), 'davet edilen plan yapmadan ödül yok';
  assert public.referral_count() = 0, 'henüz ödül kazandıran yok';
end $$;
reset role;
-- Kotayı istemciden tüketmek ödül vermez; ödülü yalnızca sunucu (plan üretince) verir.
insert into public.usage_events (user_id, feature) values ('00000000-0000-0000-0000-00000000000c', 'itinerary_generation');
do $$ begin
  assert not exists (select 1 from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000b' and product_id = 'yola_referral'), 'kota kaydı ödül vermemeli';
end $$;
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert tests.throws($q$ select public.reward_referrer(auth.uid()) $q$), 'istemci ödül işlevini çağıramaz';
end $$;
reset role;
select public.reward_referrer('00000000-0000-0000-0000-00000000000c');
select public.reward_referrer('00000000-0000-0000-0000-00000000000c');
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.subscriptions where user_id = auth.uid() and product_id = 'yola_referral' and expires_at > now() + interval '6 days') = 1, 'ilk planla davet edene bir kez 7 gün Pro';
  assert public.referral_count() = 1, 'davet sayısı';
end $$;

-- ---------------------------------------------------------------------------
\echo '18c. Seyahat soruları: ulaşım türü, günlük bütçe ve 1000 karakterlik not'
reset role;
call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  update public.trips set local_transport = 'car', notes = repeat('a', 1000), budget_amount = 120, budget_currency = 'EUR'
    where id = '10000000-0000-0000-0000-000000000001';
  assert (select local_transport from public.trips where id = '10000000-0000-0000-0000-000000000001') = 'car', 'ulaşım türü kaydedilir';
  assert (select char_length(notes) from public.trips where id = '10000000-0000-0000-0000-000000000001') = 1000, '1000 karakter not kabul edilir';
  assert tests.throws($q$ update public.trips set notes = repeat('a', 1001) where id = '10000000-0000-0000-0000-000000000001' $q$), 'not 1000 karakteri geçemez';
  assert tests.throws($q$ update public.trips set local_transport = 'rocket' where id = '10000000-0000-0000-0000-000000000001' $q$), 'geçersiz ulaşım türü reddedilir';
  assert (select local_transport from public.trips where id = '10000000-0000-0000-0000-000000000002') = 'mixed' or not exists (select 1 from public.trips where id = '10000000-0000-0000-0000-000000000002'), 'varsayılan karışık';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18d. Seyahat paylaşımı: Pro üye arkadaşını yalnızca görüntüleyici olarak ekler'
reset role;
insert into public.subscriptions (user_id, plan, status, store, product_id, expires_at)
  values ('00000000-0000-0000-0000-00000000000a', 'pro_monthly', 'active', 'promotional', 'test_share', now() + interval '30 days');
call tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert tests.throws($q$ select public.create_trip_invite('10000000-0000-0000-0000-000000000001', 'can@example.com') $q$), 'başkasının seyahatine davet edilemez';
end $$;
reset role;
call tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$
declare v_token text;
begin
  assert tests.throws($q$ select public.create_trip_invite('10000000-0000-0000-0000-000000000001', 'ayse@example.com') $q$), 'kendini davet edemez';
  assert tests.throws($q$ select public.create_trip_invite('10000000-0000-0000-0000-000000000001', 'gecersiz') $q$), 'geçersiz e-posta reddedilir';
  v_token := public.create_trip_invite('10000000-0000-0000-0000-000000000001', ' CAN@Example.com ');
  assert length(v_token) >= 40, 'davet kodu üretilir';
  assert (select count(*) from public.trip_invites) = 1, 'sahibi davetini görür';
  perform set_config('tests.invite', v_token, false);
end $$;
reset role;
call tests.login('00000000-0000-0000-0000-00000000000b');
set role authenticated;
do $$ begin
  assert (select count(*) from public.trip_invites) = 0, 'başkası davetleri göremez';
  assert tests.throws(format($q$ select public.accept_trip_invite(%L) $q$, current_setting('tests.invite'))), 'başka e-posta kabul edemez';
end $$;
reset role;
-- Şifreyle doğrudan açılmış (e-postası kanıtlanmamış) oturum daveti göremez ve kabul edemez.
call tests.login('00000000-0000-0000-0000-00000000000c');
select set_config('request.jwt.claims', '{"amr":[{"method":"password","timestamp":1}]}', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.my_trip_invites()) = 0, 'kanıtsız oturum daveti görmemeli';
  assert tests.throws(format($q$ select public.accept_trip_invite(%L) $q$, current_setting('tests.invite'))), 'kanıtsız oturum kabul edememeli';
end $$;
reset role;
-- E-posta koduyla giriş e-postayı kanıtlar.
select set_config('request.jwt.claims', '{"amr":[{"method":"otp","timestamp":1}]}', false);
call tests.login('00000000-0000-0000-0000-00000000000c');
set role authenticated;
do $$ begin
  assert (select count(*) from public.my_trip_invites()) = 1, 'davet edilen bekleyen daveti görür';
  assert not exists (select 1 from public.trips where id = '10000000-0000-0000-0000-000000000001'), 'kabulden önce seyahati görmez';
  assert public.accept_trip_invite(current_setting('tests.invite')) = '10000000-0000-0000-0000-000000000001', 'kabul edilir';
  assert exists (select 1 from public.trips where id = '10000000-0000-0000-0000-000000000001'), 'kabulden sonra seyahati görür';
  assert (select count(*) from public.my_trip_invites()) = 0, 'kabul edilen davet bekleyenlerden düşer';
  assert (select role from public.trip_members where user_id = auth.uid() and trip_id = '10000000-0000-0000-0000-000000000001') = 'viewer', 'rol yalnızca görüntüleyici';
  assert not public.can_edit_trip('10000000-0000-0000-0000-000000000001'), 'düzenleyemez';
  update public.trips set title = 'Hacklendi' where id = '10000000-0000-0000-0000-000000000001';
  assert (select title from public.trips where id = '10000000-0000-0000-0000-000000000001') <> 'Hacklendi', 'görüntüleyici başlığı değiştiremez';
  assert tests.throws($q$ select public.create_trip_invite('10000000-0000-0000-0000-000000000001', 'bea@example.com') $q$), 'görüntüleyici başkasını davet edemez';
  delete from public.trips where id = '10000000-0000-0000-0000-000000000001';
  assert exists (select 1 from public.trips where id = '10000000-0000-0000-0000-000000000001'), 'görüntüleyici seyahati silemez';
end $$;
reset role;
select set_config('request.jwt.claims', '', false);
-- Sahip, davet olmadan doğrudan üye ekleyemez (Pro şartı, onay ve engeller atlanmasın).
call tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  assert tests.throws($q$ insert into public.trip_members (trip_id, user_id, role)
    values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'editor') $q$), 'davetsiz üye eklenemez';
  -- Bea, Can'ı engelledi; Ayşe bunu öğrenemez.
  assert not public.is_blocked_between('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000c'), 'başkalarının engel durumu sızmamalı';
end $$;
reset role;
call tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  perform public.revoke_trip_invite((select id from public.trip_invites limit 1));
  assert not exists (select 1 from public.trip_members where user_id = '00000000-0000-0000-0000-00000000000c' and trip_id = '10000000-0000-0000-0000-000000000001'), 'geri alınca görüntüleyici çıkar';
end $$;
reset role;
-- Pro olmayan sahip davet edemez.
delete from public.subscriptions where user_id = '00000000-0000-0000-0000-00000000000a';
call tests.login('00000000-0000-0000-0000-00000000000a');
set role authenticated;
do $$ begin
  assert tests.throws($q$ select public.create_trip_invite('10000000-0000-0000-0000-000000000001', 'can@example.com') $q$), 'Pro olmayan davet edemez';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18b. Gezginler moderasyonu: 3 farklı şikayet askıya alır, hız sınırları'
reset role;
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000d1', 'r1@example.com', '{"display_name": "R1"}'),
  ('00000000-0000-0000-0000-0000000000d2', 'r2@example.com', '{"display_name": "R2"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'r3@example.com', '{"display_name": "R3"}'),
  ('00000000-0000-0000-0000-0000000000d4', 'target@example.com', '{"display_name": "Hedef"}');
update public.profiles set birth_year = 1990, display_name = coalesce(display_name, 'Test');
set role authenticated;
call tests.login('00000000-0000-0000-0000-0000000000d4');
insert into public.consents (consent, granted, version) values ('social_matching', true, '1.0'), ('location', true, '1.0');
insert into public.social_profiles (user_id, is_visible, city, approx_location)
  values (auth.uid(), true, 'Roma', 'SRID=4326;POINT(12.49 41.89)');

-- Aynı kişinin tekrarlayan şikayetleri sayıyı artırmaz.
call tests.login('00000000-0000-0000-0000-0000000000d1');
insert into public.user_reports (reported_id, reason) values ('00000000-0000-0000-0000-0000000000d4', 'harassment');
insert into public.user_reports (reported_id, reason) values ('00000000-0000-0000-0000-0000000000d4', 'harassment');
call tests.login('00000000-0000-0000-0000-0000000000d2');
insert into public.user_reports (reported_id, reason) values ('00000000-0000-0000-0000-0000000000d4', 'unsafe_behavior');
reset role;
do $$ begin
  assert (select is_visible from public.social_profiles where user_id = '00000000-0000-0000-0000-0000000000d4'), '2 farklı şikayet askıya almamalı';
end $$;
set role authenticated;
call tests.login('00000000-0000-0000-0000-0000000000d3');
insert into public.user_reports (reported_id, reason) values ('00000000-0000-0000-0000-0000000000d4', 'fake_profile');
reset role;
do $$ begin
  assert not (select is_visible from public.social_profiles where user_id = '00000000-0000-0000-0000-0000000000d4'), '3 farklı şikayet profili gizlemeli';
  assert exists (select 1 from public.social_suspensions where user_id = '00000000-0000-0000-0000-0000000000d4' and suspended_until > now() + interval '13 days');
end $$;
-- Askıdayken tekrar görünür olamaz, askı tablosunu istemci okuyamaz/yazamaz.
set role authenticated;
call tests.login('00000000-0000-0000-0000-0000000000d4');
do $$ begin
  assert tests.throws($q$ update public.social_profiles set is_visible = true where user_id = auth.uid() $q$), 'askıdaki kullanıcı görünür olamaz';
  assert (select count(*) from public.social_suspensions) = 0, 'askı tablosu istemciye kapalı olmalı';
end $$;
delete from public.social_suspensions;
reset role;
do $$ begin
  assert exists (select 1 from public.social_suspensions where user_id = '00000000-0000-0000-0000-0000000000d4'), 'askı istemciden silinemez';
end $$;
set role authenticated;
-- Günde en fazla 20 şikayet.
call tests.login('00000000-0000-0000-0000-0000000000d1');
do $$
declare i int;
begin
  for i in 1..30 loop
    begin
      insert into public.user_reports (reported_id, reason) values ('00000000-0000-0000-0000-0000000000d2', 'spam');
    exception when others then
      null;
    end;
  end loop;
  assert (select count(*) from public.user_reports where reporter_id = auth.uid()) <= 20, 'şikayet sayısı günlük 20 ile sınırlı olmalı';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18c. Uçuş durumu önbelleği istemciye kapalı'
reset role;
insert into public.flight_status_cache (flight_number, flight_date, origin_code, data) values ('TK1865', '2026-10-26', 'ZRH', '{"state":"delayed"}');
set role authenticated;
call tests.login('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  assert tests.throws($q$ select * from public.flight_status_cache $q$), 'istemci uçuş önbelleğini okuyamamalı';
  assert tests.throws($q$ insert into public.flight_status_cache (flight_number, flight_date) values ('XX1', '2026-10-26') $q$), 'istemci yazamamalı';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18d. Push token kaydı: yalnızca işlevle, başkasının token''ı alınamaz, iç tablolar kapalı'
set role authenticated;
call tests.login('00000000-0000-0000-0000-0000000000d1');
select public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ios');
do $$ begin
  assert (select count(*) from public.push_tokens) = 1, 'kendi token''ını görür';
  assert tests.throws($q$ insert into public.push_tokens (token, platform) values ('ExponentPushToken[bbbbbbbbbbbbbbbbbbbbbb]', 'ios') $q$), 'doğrudan yazılamaz';
  assert tests.throws($q$ select public.register_push_token('geçersiz', 'ios') $q$), 'biçimi geçersiz token reddedilir';
  assert tests.throws($q$ select * from public.internal_secrets $q$), 'sırlar istemciye kapalı';
  assert tests.throws($q$ select * from public.flight_alerts_sent $q$), 'gönderim kayıtları istemciye kapalı';
end $$;
-- Aynı cihazda başka hesap girince token ona geçer; eski hesap artık görmez.
call tests.login('00000000-0000-0000-0000-0000000000d2');
select public.register_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]', 'ios');
do $$ begin
  assert (select count(*) from public.push_tokens) = 1;
end $$;
call tests.login('00000000-0000-0000-0000-0000000000d1');
do $$ begin
  assert (select count(*) from public.push_tokens) = 0, 'token yeni hesaba geçti';
  perform public.unregister_push_token('ExponentPushToken[aaaaaaaaaaaaaaaaaaaaaa]');
end $$;
call tests.login('00000000-0000-0000-0000-0000000000d2');
do $$ begin
  assert (select count(*) from public.push_tokens) = 1, 'başkasının token''ı silinemez';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18e. Günlük: kişisel kayıt, üye olmayan yazamaz, başkasının fotoğrafına bağlanılamaz'
reset role;
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.journal_entries (trip_id, entry_date, note, mood)
values ('10000000-0000-0000-0000-000000000001', current_date, 'Harika bir gün', 'amazing');
do $$ begin
  assert (select count(*) from public.journal_entries) = 1, 'kendi kaydını görür';
  assert tests.throws($q$ insert into public.journal_entries (trip_id, entry_date, note) values ('10000000-0000-0000-0000-000000000001', current_date, 'aynı gün ikinci') $q$), 'günde tek kayıt';
  assert tests.throws($q$ insert into public.journal_entries (trip_id, entry_date, note, photos) values ('10000000-0000-0000-0000-000000000001', current_date + 1, 'x', array['00000000-0000-0000-0000-00000000000b/10000000-0000-0000-0000-000000000001/a.jpg']) $q$), 'başkasının klasörüne bağlanamaz';
  assert tests.throws($q$ insert into public.journal_entries (trip_id, entry_date) values ('10000000-0000-0000-0000-000000000001', current_date + 2) $q$), 'boş kayıt olmaz';
end $$;
insert into public.journal_entries (trip_id, entry_date, photos)
values ('10000000-0000-0000-0000-000000000001', current_date + 1, array['00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/a.jpg']);
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.journal_entries) = 0, 'başkası günlüğü görmez';
  assert tests.throws($q$ insert into public.journal_entries (trip_id, entry_date, note) values ('10000000-0000-0000-0000-000000000001', current_date + 5, 'üye değilim') $q$), 'üye olmayan yazamaz';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18f. Fiyat takibi: sistem sütunları yazılamaz, 5 aktif sınırı, başkası görmez'
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000a');
insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on, target_price)
values ('IST', 'Istanbul', 'ROM', 'Rome', current_date + 30, 120);
do $$ begin
  assert (select count(*) from public.price_watches) = 1;
  assert tests.throws($q$ update public.price_watches set last_price = 1 $q$), 'son fiyatı istemci yazamaz';
  assert tests.throws($q$ insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on, last_price) values ('IST','Istanbul','PAR','Paris', current_date + 5, 9) $q$), 'sistem sütunuyla eklenemez';
  assert tests.throws($q$ insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on) values ('IST','Istanbul','IST','Istanbul', current_date + 5) $q$), 'aynı kalkış ve varış';
  assert tests.throws($q$ insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on) values ('IST','Istanbul','PAR','Paris', current_date - 1) $q$), 'geçmiş tarih';
  assert tests.throws($q$ insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on, return_on) values ('IST','Istanbul','PAR','Paris', current_date + 5, current_date + 5) $q$), 'dönüş gidişten sonra olmalı';
end $$;
insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on) values
  ('IST','Istanbul','PAR','Paris', current_date + 5), ('IST','Istanbul','LON','London', current_date + 5),
  ('IST','Istanbul','BER','Berlin', current_date + 5), ('IST','Istanbul','MAD','Madrid', current_date + 5);
do $$ begin
  assert tests.throws($q$ insert into public.price_watches (origin_code, origin_name, destination_code, destination_name, depart_on) values ('IST','Istanbul','VIE','Vienna', current_date + 5) $q$), 'en fazla 5 aktif takip';
end $$;
call tests.login('00000000-0000-0000-0000-00000000000b');
do $$ begin
  assert (select count(*) from public.price_watches) = 0, 'başkasının takibini görmez';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '18g. Günlük kovası: yalnızca kendi klasörü, en fazla 300 dosya'
reset role;
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000a');
insert into storage.objects (bucket_id, name) values ('journal', '00000000-0000-0000-0000-00000000000a/t/1.jpg');
do $$ begin
  assert tests.throws($q$ insert into storage.objects (bucket_id, name) values ('journal', '00000000-0000-0000-0000-00000000000b/t/1.jpg') $q$), 'başkasının klasörüne yazılamaz';
end $$;
reset role;
insert into storage.objects (bucket_id, name) select 'journal', '00000000-0000-0000-0000-00000000000a/t/x' || g || '.jpg' from generate_series(1, 299) g;
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000a');
do $$ begin
  assert tests.throws($q$ insert into storage.objects (bucket_id, name) values ('journal', '00000000-0000-0000-0000-00000000000a/t/over.jpg') $q$), '300 dosya sınırı';
end $$;
reset role;
delete from storage.objects where bucket_id = 'journal';

-- ---------------------------------------------------------------------------
\echo '18h. Aynı ada ikinci seyahat engellenir (kullanıcı başına, harf/boşluk fark etmez)'
set role authenticated;
call tests.login('00000000-0000-0000-0000-00000000000b');
insert into public.trips (id, title) values ('10000000-0000-0000-0000-0000000000e1', 'Lizbon');
do $$ begin
  assert tests.throws($q$ insert into public.trips (title) values ('  lizbon ') $q$), 'aynı ad (harf ve boşluk farkıyla) engellenir';
end $$;
call tests.login('00000000-0000-0000-0000-00000000000c');
do $$ begin
  assert not tests.throws($q$ insert into public.trips (title) values ('Lizbon') $q$), 'başka kullanıcı aynı adı kullanabilir';
end $$;
call tests.login('00000000-0000-0000-0000-00000000000b');
update public.trips set status = 'cancelled' where id = '10000000-0000-0000-0000-0000000000e1';
do $$ begin
  assert not tests.throws($q$ insert into public.trips (title) values ('Lizbon') $q$), 'iptal edilmiş seyahat sayılmaz';
end $$;
reset role;

-- ---------------------------------------------------------------------------
\echo '19. Hesap silinince tüm veri silinir (KVKK/GDPR)'
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
