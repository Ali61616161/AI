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
\echo '9. Hesap silinince tüm veri silinir (KVKK/GDPR)'
reset role;
delete from auth.users where id = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert not exists (select 1 from public.trips where owner_id = '00000000-0000-0000-0000-00000000000a');
  assert not exists (select 1 from public.plan_items);
  assert not exists (select 1 from public.match_invites);
  assert not exists (select 1 from public.consents where user_id = '00000000-0000-0000-0000-00000000000a');
end $$;

\echo 'Tüm şema testleri geçti.'
