#!/usr/bin/env node
// Mağaza ekran görüntülerini (App Store iPhone 6.9", iPad 13", Google Play telefon)
// 9 dilde, uygulamanın gerçek web derlemesinden üretir.
//
// Akış:
//   1. Yerel test yığınına (scripts/local-stack/start.sh) bir demo kullanıcı yazılır:
//      Pro abonelik, İstanbul'da yaşayan TR pasaportlu + Schengen vizeli gezgin,
//      Roma seyahati ve rotası, 25 gezilen ülke, belgeler, Schengen kalışları.
//   2. Uygulama `expo export --platform web` ile yerel yığına bağlı derlenir
//      (anahtarlar sadece ortam değişkeni olarak verilir, dosyaya yazılmaz).
//   3. Playwright her dil ve cihaz için ekranları açıp görüntüsünü alır. AI cevapları
//      (Planı Değiştir, canlı çeviri, bilet okuma) dile göre demo içerikle taklit edilir.
//   4. Görüntüler marka arka planı, başlık ve cihaz çerçevesiyle birleştirilip tam
//      mağaza boyutunda kaydedilir.
//
// Kullanım (yığın açıkken; PGHOST/PGPORT/PGUSER start.sh ile aynı olmalı):
//   LOG_DIR=<start.sh klasörü> DEV_DB=yola_dev node store/screenshots/make.mjs
//   Seçenekler: --dist <klasör>    hazır web derlemesini kullan (derlemeyi atla)
//               --langs tr,en      sadece bu diller
//               --devices ios,ipad,android
//               --screens 1,4      sadece bu ekranlar (1-10)
//               --raw <klasör>     ham ekran görüntülerini bu klasörde tut
// SADECE yerel test yığını içindir; gerçek Supabase anahtarı kullanmaz.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

import { LANGS, LOCALES, SUNNY, conversation, eveningPlan, getaways, itinerary, parsedTickets, replanResult } from './content.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');

// ---------------------------------------------------------------------------
// Başlıklar (≤ ~30 karakter). Özellik adları uygulamanın dil dosyalarıyla aynı.
// ---------------------------------------------------------------------------
const SCREENS = [
  { n: 1, slug: 'itinerary' },
  { n: 2, slug: 'evening' },
  { n: 3, slug: 'replan' },
  { n: 4, slug: 'passport' },
  { n: 5, slug: 'visited' },
  { n: 6, slug: 'translate' },
  { n: 7, slug: 'spin' },
  { n: 8, slug: 'getaways' },
  { n: 9, slug: 'ticket' },
  { n: 10, slug: 'documents' },
];

const CAPTIONS = {
  tr: ['Gün gün hazır seyahat planı', 'Bu akşam ne yapsak?', 'Plan bozuldu mu? Tek dokunuş', 'Pasaportunun gücünü gör', 'Gezdiğin ülkeler, rozetlerin', 'Herkesle canlı konuş', 'Çarkı çevir, yola çık', 'Hafta sonu kaçamakları', 'Bileti yükle, gerisi AI’da', 'Belgelerim ve Schengen 90/180'],
  en: ['Your trip, planned day by day', 'What shall we do tonight?', 'Plans changed? Replan in 1 tap', 'See your passport power', 'Every country you’ve visited', 'Talk to anyone, live', 'Spin the wheel, go anywhere', 'Weekend getaways near you', 'Snap a ticket. Trip built.', 'Your docs & Schengen 90/180'],
  es: ['Tu viaje, día a día', '¿Qué hacemos esta noche?', '¿Cambio de planes? Un toque', 'El poder de tu pasaporte', 'Todos los países que visitaste', 'Habla con cualquiera, en vivo', 'Gira la ruleta y viaja', 'Escapadas de fin de semana', 'Sube tu billete y listo', 'Documentos y Schengen 90/180'],
  fr: ['Ton voyage, jour par jour', 'On fait quoi ce soir ?', 'Un imprévu ? Plan refait', 'La force de ton passeport', 'Tous tes pays visités', 'Parle à tous, en direct', 'Fais tourner la roue, pars !', 'Escapades du week-end', 'Importe ton billet, c’est prêt', 'Documents et Schengen 90/180'],
  de: ['Deine Reise, Tag für Tag', 'Was machen wir heute Abend?', 'Planänderung? Ein Tipp', 'Wie stark ist dein Pass?', 'Alle deine besuchten Länder', 'Mit jedem live sprechen', 'Dreh am Rad – und los!', 'Kurztrips fürs Wochenende', 'Ticket hochladen, fertig', 'Dokumente & Schengen 90/180'],
  it: ['Il viaggio, giorno per giorno', 'Cosa facciamo stasera?', 'Imprevisto? Piano rifatto', 'La forza del tuo passaporto', 'Tutti i paesi che hai visitato', 'Parla con tutti, dal vivo', 'Gira la ruota e parti', 'Gite per il weekend', 'Carica il biglietto, fatto', 'Documenti e Schengen 90/180'],
  ru: ['Поездка по дням — готова', 'Чем займёмся вечером?', 'Планы сорвались? Один тап', 'Сила вашего паспорта', 'Все страны, где вы были', 'Говорите с кем угодно', 'Крути колесо — и в путь', 'Поездки на выходные', 'Загрузите билет — и всё', 'Документы и Шенген 90/180'],
  ar: ['رحلتك يومًا بيوم', 'ماذا نفعل الليلة؟', 'تغيّرت الخطة؟ بلمسة واحدة', 'اكتشف قوة جواز سفرك', 'كل البلدان التي زرتها', 'تحدّث مع أي شخص مباشرة', 'أدر العجلة وانطلق', 'رحلات قريبة لعطلة الأسبوع', 'حمّل التذكرة والباقي علينا', 'مستنداتي وشنغن 90/180'],
  zh: ['每日行程，一键生成', '今晚做点什么？', '计划有变？一键调整', '看看你的护照实力', '我去过的国家，一目了然', '实时对话翻译', '转转盘，说走就走', '周末周边小旅行', '上传机票，AI 搞定行程', '我的证件与申根 90/180'],
};

// ---------------------------------------------------------------------------
// Cihazlar: ham görüntü (CSS px × ölçek) ve mağaza boyutu
// ---------------------------------------------------------------------------
const DEVICES = {
  ios: { dir: 'ios-6.9', locale: 'asc', canvas: [1320, 2868], viewport: { width: 430, height: 932 }, scale: 3, statusBar: 54, kind: 'iphone', caption: { top: 190, size: 100, area: 600 } },
  ipad: { dir: 'ipad-13', locale: 'asc', canvas: [2064, 2752], viewport: { width: 768, height: 1024 }, scale: 2.6875, statusBar: 24, kind: 'ipad', caption: { top: 150, size: 112, area: 520 } },
  android: { dir: 'android-phone', locale: 'play', canvas: [1080, 1920], viewport: { width: 412, height: 800 }, scale: 2.625, statusBar: 30, kind: 'android', caption: { top: 110, size: 72, area: 390 } },
};

// ---------------------------------------------------------------------------
// Ayarlar
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const onlyLangs = opt('langs')?.split(',') ?? LANGS;
const onlyDevices = opt('devices')?.split(',') ?? Object.keys(DEVICES);
const onlyScreens = opt('screens')?.split(',').map(Number) ?? SCREENS.map((s) => s.n);

const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON_KEY = process.env.ANON_KEY ?? (process.env.LOG_DIR ? fs.readFileSync(path.join(process.env.LOG_DIR, 'anon-key'), 'utf8').trim() : null);
if (!ANON_KEY) throw new Error('ANON_KEY veya LOG_DIR gerekli (scripts/local-stack/start.sh çıktısı)');
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(SUPABASE_URL)) throw new Error('Sadece yerel test yığınıyla çalışır');
const DB = process.env.DEV_DB ?? 'yola_dev';
const PORT = Number(process.env.SHOTS_PORT ?? 8097);
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'yola-shots-'));
const RAW = opt('raw') ?? path.join(WORK, 'raw');
fs.mkdirSync(RAW, { recursive: true });

const DEMO_ID = 'de300000-0000-4000-8000-000000000001';
const DEMO_EMAIL = 'demo@yola.app';
const REVIEW_PASSWORD = process.env.LOCAL_REVIEW_PASSWORD ?? 'yola-review-123';
const VISITED = ['AE', 'AT', 'BR', 'CA', 'CH', 'CZ', 'DE', 'EG', 'ES', 'FR', 'GB', 'GE', 'GR', 'HR', 'HU', 'IT', 'JP', 'KR', 'MA', 'MX', 'NL', 'PT', 'TH', 'TR', 'US'];
const HOME = { lat: 41.0369, lng: 28.985 };

// Tarihler İstanbul saatine göre; seyahat dün başladı, bugün 2. gün.
const isoDay = (offset) => new Date(Date.now() + offset * 864e5).toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
const TODAY = isoDay(0);
const TRIP_ID = 'de300000-0000-4000-8000-0000000000a1';
const PLAN_ID = 'de300000-0000-4000-8000-0000000000b1';
const TRIP_DAYS = [-1, 0, 1, 2, 3].map(isoDay);

const log = (...m) => console.log(new Date().toISOString().slice(11, 19), ...m);

// ---------------------------------------------------------------------------
// Yardımcılar
// ---------------------------------------------------------------------------
const point = (lat, lng) => `extensions.st_setsrid(extensions.st_makepoint(${lng}, ${lat}), 4326)::extensions.geography`;
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);

function psql(sql) {
  const r = spawnSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB], { input: sql, encoding: 'utf8', env: { ...process.env, PGOPTIONS: '-c client_min_messages=warning' } });
  if (r.status !== 0) throw new Error(`psql hatası:\n${r.stderr}`);
  return r.stdout;
}

/** Bir saat diliminde yerel saat → UTC ISO. */
function zoned(date, time, timeZone) {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(guess).map((p) => [p.type, p.value]));
  const asLocal = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return new Date(guess.getTime() - (asLocal - guess.getTime())).toISOString();
}

const locales = {};
function tr(lang, key, vars = {}) {
  locales[lang] ??= JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales', `${lang}.json`), 'utf8'));
  let v = key.split('.').reduce((o, k) => o?.[k], locales[lang]);
  if (v === undefined && 'count' in vars) {
    const at = (suffix) => key.split('.').reduce((o, k, i, a) => o?.[i === a.length - 1 ? `${k}_${suffix}` : k], locales[lang]);
    v = at(vars.count === 0 ? 'zero' : new Intl.PluralRules(lang).select(vars.count)) ?? at(new Intl.PluralRules(lang).select(vars.count)) ?? at('other');
  }
  if (typeof v !== 'string') throw new Error(`Çeviri yok: ${lang} ${key}`);
  return v.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? '');
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** "Speak in {{language}}" → /^Speak in .*$/ */
const templateRe = (lang, key) => {
  locales[lang] ??= JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales', `${lang}.json`), 'utf8'));
  const v = key.split('.').reduce((o, k) => o?.[k], locales[lang]);
  return new RegExp('^' + v.split(/\{\{\w+\}\}/).map(escapeRe).join('.*') + '$');
};

// ---------------------------------------------------------------------------
// 1. Demo verisi
// ---------------------------------------------------------------------------
function seed() {
  log('demo verisi yazılıyor', DB);
  const pastTrips = [
    ['de300000-0000-4000-8000-0000000000c1', 'Paris', 'FR', -200, 48.8566, 2.3522],
    ['de300000-0000-4000-8000-0000000000c2', 'Barcelona', 'ES', -75, 41.3874, 2.1686],
    ['de300000-0000-4000-8000-0000000000c3', 'Tokyo', 'JP', -320, 35.6762, 139.6503],
    ['de300000-0000-4000-8000-0000000000c4', 'Marrakech', 'MA', -420, 31.6295, -7.9811],
    ['de300000-0000-4000-8000-0000000000c5', 'New York', 'US', -560, 40.7128, -74.006],
  ];
  const crowd = ['TR', 'GR', 'IT', 'DE', 'FR', 'ES', 'GB', 'NL', 'AT', 'CH', 'BG', 'GE', 'AZ', 'AE', 'EG', 'US', 'PT', 'HU', 'CZ', 'PL', 'HR', 'TH', 'JP', 'CY', 'RU', 'UA', 'MA', 'TN', 'SA', 'QA', 'IR', 'CN', 'KR', 'IN', 'MX', 'CA', 'BR', 'AR', 'ID', 'MY'];
  const rome = itinerary('en');
  psql(`
begin;
delete from auth.users where email = ${q(DEMO_EMAIL)} or email like 'crowd-%@yola.local';
insert into auth.users (id, email, raw_user_meta_data) values (${q(DEMO_ID)}, ${q(DEMO_EMAIL)}, '{"language": "en"}');
update public.profiles set display_name = 'Deniz', passport_country = 'TR', extra_visas = '{schengen_visa}', home_city = 'İstanbul', home_country = 'TR',
  home_lat = 41.04, home_lng = 28.99, home_currency = 'TRY', default_companion = 'couple', default_budget = 'mid', interests = '{food,history,art}',
  onboarding_completed_at = now() where id = ${q(DEMO_ID)};
insert into public.subscriptions (user_id, plan, status, store, product_id, expires_at)
  values (${q(DEMO_ID)}, 'pro_yearly', 'active', 'app_store', 'yola_pro_yearly', now() + interval '1 year');

-- Roma seyahati (dün başladı) ve biletleri
insert into public.trips (id, owner_id, title, status, start_date, end_date, companion_type, budget_tier, interests, budget_currency, adults)
  values (${q(TRIP_ID)}, ${q(DEMO_ID)}, 'Rome', 'active', ${q(TRIP_DAYS[0])}, ${q(TRIP_DAYS[4])}, 'couple', 'mid', '{food,history,art}', 'EUR', 2);
insert into public.trip_members (trip_id, user_id, role) values (${q(TRIP_ID)}, ${q(DEMO_ID)}, 'owner') on conflict do nothing;
insert into public.trip_destinations (trip_id, position, city, country_code, arrive_on, depart_on, location)
  values (${q(TRIP_ID)}, 0, 'Rome', 'IT', ${q(TRIP_DAYS[0])}, ${q(TRIP_DAYS[4])}, ${point(41.9028, 12.4964)});
insert into public.reservations (trip_id, created_by, type, title, provider_name, reference_code, starts_at, ends_at, start_timezone, end_timezone, origin_name, origin_code, destination_name, destination_code)
  values (${q(TRIP_ID)}, ${q(DEMO_ID)}, 'flight', 'Turkish Airlines TK1861', 'Turkish Airlines', 'X7KQ2M', ${q(zoned(TRIP_DAYS[0], '08:15', 'Europe/Istanbul'))}, ${q(zoned(TRIP_DAYS[0], '10:05', 'Europe/Rome'))}, 'Europe/Istanbul', 'Europe/Rome', 'Istanbul Airport', 'IST', 'Rome Fiumicino', 'FCO'),
         (${q(TRIP_ID)}, ${q(DEMO_ID)}, 'flight', 'Turkish Airlines TK1866', 'Turkish Airlines', 'X7KQ2M', ${q(zoned(TRIP_DAYS[4], '17:55', 'Europe/Rome'))}, ${q(zoned(TRIP_DAYS[4], '21:40', 'Europe/Istanbul'))}, 'Europe/Rome', 'Europe/Istanbul', 'Rome Fiumicino', 'FCO', 'Istanbul Airport', 'IST');
insert into public.reservations (trip_id, created_by, type, title, provider_name, reference_code, starts_at, ends_at, start_timezone, end_timezone, address)
  values (${q(TRIP_ID)}, ${q(DEMO_ID)}, 'hotel', 'Hotel Artemide', 'Booking.com', '4183902557', ${q(zoned(TRIP_DAYS[0], '14:00', 'Europe/Rome'))}, ${q(zoned(TRIP_DAYS[4], '11:00', 'Europe/Rome'))}, 'Europe/Rome', 'Europe/Rome', 'Via Nazionale 22, Roma');

-- Aktif rota (metinler her dil için ayrıca güncellenir)
insert into public.plan_versions (id, trip_id, version, reason, summary, is_active, created_by, trip_start_date, trip_end_date)
  values (${q(PLAN_ID)}, ${q(TRIP_ID)}, 1, 'initial', ${q(rome.summary)}, true, ${q(DEMO_ID)}, ${q(TRIP_DAYS[0])}, ${q(TRIP_DAYS[4])});
${TRIP_DAYS.map(
  (date, d) => `insert into public.day_plans (id, plan_version_id, trip_id, date, city, title) values ('de300000-0000-4000-8000-0000000001${d}0', ${q(PLAN_ID)}, ${q(TRIP_ID)}, ${q(date)}, 'Rome', ${q(rome.day)});
${rome.items
  .map(
    (it, i) => `insert into public.plan_items (id, day_plan_id, trip_id, position, kind, title, description, starts_at, ends_at, timezone, place_name, estimated_cost, cost_currency, priority, is_indoor, booking_url, google_place_id, location, rating, rating_count, maps_url, place_status)
  values ('de300000-0000-4000-8000-0000000002${d}${i}', 'de300000-0000-4000-8000-0000000001${d}0', ${q(TRIP_ID)}, ${i}, ${q(it.kind)}, ${q(it.title)}, ${q(it.description)}, ${q(zoned(date, it.start, 'Europe/Rome'))}, ${q(zoned(date, it.end, 'Europe/Rome'))}, 'Europe/Rome',
          ${q(it.place)}, ${it.cost}, 'EUR', ${it.priority}, ${it.indoor}, ${q(it.booking ?? null)}, ${q(`demo-${i}`)}, ${point(it.lat, it.lng)}, ${it.rating}, ${it.count},
          ${q(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(it.place + ' Roma')}`)}, 'OPERATIONAL');`,
  )
  .join('\n')}`,
).join('\n')}

-- Geçmiş seyahatler (gezilen şehirler)
${pastTrips
  .map(
    ([id, city, cc, off, lat, lng]) => `insert into public.trips (id, owner_id, title, status, start_date, end_date, companion_type, budget_tier) values (${q(id)}, ${q(DEMO_ID)}, ${q(city)}, 'completed', ${q(isoDay(off))}, ${q(isoDay(off + 5))}, 'couple', 'mid');
insert into public.trip_members (trip_id, user_id, role) values (${q(id)}, ${q(DEMO_ID)}, 'owner') on conflict do nothing;
insert into public.trip_destinations (trip_id, position, city, country_code, arrive_on, depart_on, location) values (${q(id)}, 0, ${q(city)}, ${q(cc)}, ${q(isoDay(off))}, ${q(isoDay(off + 5))}, ${point(lat, lng)});`,
  )
  .join('\n')}

insert into public.visited_countries (user_id, country_code) select ${q(DEMO_ID)}, unnest(array[${VISITED.map(q).join(',')}]);
insert into public.travel_documents (user_id, kind, country_code, label, expires_on) values
  (${q(DEMO_ID)}, 'passport', 'TR', null, ${q(isoDay(1240))}),
  (${q(DEMO_ID)}, 'visa', 'IT', 'Schengen', ${q(isoDay(150))}),
  (${q(DEMO_ID)}, 'id_card', 'TR', null, ${q(isoDay(2210))});
insert into public.schengen_stays (user_id, entry_on, exit_on) values
  (${q(DEMO_ID)}, ${q(isoDay(-160))}, ${q(isoDay(-152))}),
  (${q(DEMO_ID)}, ${q(isoDay(-75))}, ${q(isoDay(-69))}),
  (${q(DEMO_ID)}, ${q(TRIP_DAYS[0])}, ${q(TRIP_DAYS[4])});
select set_config('request.jwt.claim.sub', ${q(DEMO_ID)}, true);
insert into public.saved_places (user_id, list_name, google_place_id, name, category, lat, lng) values
  (${q(DEMO_ID)}, 'want', 'demo-mikla', 'Mikla', 'drink', 41.0319, 28.9767),
  (${q(DEMO_ID)}, 'date', 'demo-karakoy-lokantasi', 'Karaköy Lokantası', 'meal', 41.0237, 28.9776);
insert into public.place_visits (user_id, google_place_id, name, category, city, visited_on) values
  (${q(DEMO_ID)}, 'demo-galata', 'Galata Kulesi', 'walk', 'İstanbul', ${q(isoDay(-3))}),
  (${q(DEMO_ID)}, 'demo-karakoy-lokantasi', 'Karaköy Lokantası', 'meal', 'İstanbul', ${q(isoDay(-10))});

-- "Gezginlerin %X'inden fazla" satırı için anonim kalabalık (en az 1000 kullanıcı gerekir)
insert into auth.users (id, email, raw_user_meta_data) select gen_random_uuid(), 'crowd-' || g || '@yola.local', '{}' from generate_series(1, 1200) g;
insert into public.visited_countries (user_id, country_code)
  select u.id, c.code from auth.users u
  cross join lateral (select code from unnest(array[${crowd.map(q).join(',')}]) with ordinality as x(code, o) where x.o <= 1 + abs(hashtext(u.email)) % 30) c
  where u.email like 'crowd-%@yola.local';
commit;
`);
}

/** Dile bağlı metinler (AI'ın o dilde üreteceği rota) veritabanına yazılır. */
function localizeDb(lang) {
  const it = itinerary(lang);
  psql(`
begin;
update public.profiles set preferred_language = ${q(lang)} where id = ${q(DEMO_ID)};
update public.trips set title = ${q(it.trip)} where id = ${q(TRIP_ID)};
update public.trip_destinations set city = ${q(it.trip)} where trip_id = ${q(TRIP_ID)};
update public.plan_versions set summary = ${q(it.summary)} where id = ${q(PLAN_ID)};
update public.day_plans set title = ${q(it.day)}, city = ${q(it.trip)} where plan_version_id = ${q(PLAN_ID)};
${it.items.map((x, i) => `update public.plan_items set title = ${q(x.title)}, description = ${q(x.description)} where trip_id = ${q(TRIP_ID)} and position = ${i};`).join('\n')}
commit;
`);
}

async function getSession() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'content-type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: REVIEW_PASSWORD }),
  });
  const session = await res.json();
  if (session.user?.id !== DEMO_ID) throw new Error(`Demo kullanıcı oturumu alınamadı: ${JSON.stringify(session).slice(0, 200)}`);
  return session;
}

// ---------------------------------------------------------------------------
// 2. Web derlemesi ve sunucu
// ---------------------------------------------------------------------------
function build() {
  const out = path.join(WORK, 'dist');
  log('web derlemesi (expo export)…');
  execFileSync('npx', ['expo', 'export', '--clear', '--platform', 'web', '--output-dir', out], {
    cwd: ROOT,
    stdio: ['ignore', 'ignore', 'inherit'],
    env: { ...process.env, EXPO_PUBLIC_SUPABASE_URL: SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ANON_KEY, EXPO_WEB_OUTPUT: 'single', EXPO_OFFLINE: '1', CI: '1' },
  });
  return out;
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.woff2': 'font/woff2', '.json': 'application/json', '.ico': 'image/x-icon', '.svg': 'image/svg+xml' };

function serve(dist) {
  const roots = { '/__raw/': RAW, '/__fonts/': path.join(HERE, 'fonts'), '/__unbounded/': path.join(ROOT, 'node_modules/@expo-google-fonts/unbounded'), '/__work/': WORK };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file;
    const prefix = Object.keys(roots).find((p) => url.startsWith(p));
    if (prefix) file = path.join(roots[prefix], url.slice(prefix.length));
    else {
      file = path.join(dist, url);
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(dist, 'index.html');
    }
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

// ---------------------------------------------------------------------------
// 3. Ekran görüntüleri
// ---------------------------------------------------------------------------
/** Bilet yükleme ekranında seçilecek örnek biniş kartı ve otel onayı görselleri. */
async function makeTicketImages(browser) {
  const page = await browser.newPage({ viewport: { width: 600, height: 800 } });
  const files = [];
  const docs = {
    'boarding-pass-TK1861.png': `<div style="background:#fff;border-radius:24px;overflow:hidden;font:600 26px Inter,sans-serif;color:#1b2333;height:100%">
      <div style="background:#c8102e;color:#fff;padding:36px;font:800 40px Inter">TURKISH AIRLINES<div style="font:600 24px Inter;opacity:.85;margin-top:8px">BOARDING PASS</div></div>
      <div style="display:flex;justify-content:space-between;padding:40px 36px;font:800 96px Inter"><span>IST</span><span style="color:#c8102e">✈</span><span>FCO</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:0 36px">${[['FLIGHT', 'TK1861'], ['SEAT', '14A'], ['GATE', 'F4'], ['BOARDING', '07:35'], ['PASSENGER', 'YILMAZ/DENIZ'], ['PNR', 'X7KQ2M']].map(([k, v]) => `<div><div style="font-size:18px;color:#7a8499">${k}</div>${v}</div>`).join('')}</div>
      <div style="margin:44px 36px;height:110px;background:repeating-linear-gradient(90deg,#1b2333 0 4px,#fff 4px 9px,#1b2333 9px 11px,#fff 11px 16px)"></div></div>`,
    'hotel-artemide.png': `<div style="background:#fff;border-radius:24px;overflow:hidden;font:600 26px Inter,sans-serif;color:#1b2333;height:100%">
      <div style="background:#003580;color:#fff;padding:36px;font:800 40px Inter">Booking.com<div style="font:600 24px Inter;opacity:.85;margin-top:8px">Booking confirmation</div></div>
      <div style="padding:36px;font:800 52px Inter">Hotel Artemide<div style="font:500 24px Inter;color:#5b6478;margin-top:10px">Via Nazionale 22, 00184 Roma</div></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:28px;padding:0 36px">${[['CHECK-IN', '14:00'], ['CHECK-OUT', '11:00'], ['GUESTS', '2 adults'], ['ROOM', 'Deluxe Double'], ['BREAKFAST', 'Included'], ['NUMBER', '4183 902 557']].map(([k, v]) => `<div><div style="font-size:18px;color:#7a8499">${k}</div>${v}</div>`).join('')}</div></div>`,
  };
  for (const [name, html] of Object.entries(docs)) {
    await page.setContent(`<body style="margin:0;background:#dfe3ea;padding:24px;height:752px">${html}</body>`);
    const file = path.join(WORK, name);
    await page.screenshot({ path: file });
    files.push(file);
  }
  await page.close();
  return files;
}

/** Tarayıcıdaki konuşma tanıma API'sinin taklidi: sıradaki cümleyi "duymuş" gibi yapar. */
function fakeSpeechRecognition() {
  window.__speechQueue = [];
  class FakeRecognition extends EventTarget {
    start() {
      const text = window.__speechQueue.shift() ?? '';
      setTimeout(() => {
        this.dispatchEvent(new Event('start'));
        const ev = new Event('result');
        const alt = [{ transcript: text, confidence: 0.96 }];
        alt.isFinal = true;
        ev.resultIndex = 0;
        ev.results = [alt];
        this.dispatchEvent(ev);
        setTimeout(() => this.dispatchEvent(new Event('end')), 120);
      }, 200);
    }
    stop() {}
    abort() {}
  }
  window.webkitSpeechRecognition = FakeRecognition;
  window.SpeechRecognition = FakeRecognition;
  // Çark: her çalıştırmada aynı sonuç.
  let s = 20261013;
  Math.random = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
}

async function captureLanguage(browser, lang, deviceKey, session, ticketFiles) {
  const device = DEVICES[deviceKey];
  const conv = conversation(lang);
  const evening = eveningPlan(lang);
  const store = {
    'sb-localhost-auth-token': JSON.stringify(session),
    'yola.language': lang,
    'yola.appearance': JSON.stringify({ state: { appearance: 'dark' }, version: 0 }),
    'yola.session': JSON.stringify({
      state: {
        isGuest: false,
        preferences: { companion: 'couple', budget: 'mid', interests: ['food', 'history', 'art'] },
        identity: { passport: 'TR', otherPassports: [], extraVisas: ['schengen_visa'], homeCity: evening.city, homeCountry: 'TR', homeLat: 41.04, homeLng: 28.99 },
        visitedCountries: VISITED,
        onboardingCompleted: true,
        introSeen: true,
        consents: null,
      },
      version: 0,
    }),
    'yola.city': JSON.stringify({ state: { evening, getaways: getaways(lang), guestSpins: { date: '', count: 0 } }, version: 0 }),
    'yola-translate': JSON.stringify({ state: { myLanguage: conv.mine, theirLanguage: conv.theirs }, version: 0 }),
  };

  const context = await browser.newContext({
    viewport: device.viewport,
    deviceScaleFactor: device.scale,
    isMobile: deviceKey !== 'ipad',
    hasTouch: true,
    locale: LOCALES[lang].browser,
    timezoneId: 'Europe/Istanbul',
    colorScheme: 'dark',
    geolocation: { latitude: HOME.lat, longitude: HOME.lng },
    permissions: ['geolocation'],
    reducedMotion: 'reduce',
  });
  await context.addInitScript((items) => {
    for (const [k, v] of Object.entries(items)) localStorage.setItem(k, v);
  }, store);
  await context.addInitScript(fakeSpeechRecognition);

  // AI cevapları: dile göre demo içerik.
  const translations = new Map(conv.turns.map((t) => [t.said, t.translated]));
  await context.route('**/functions/v1/translate', async (route) => {
    const body = route.request().postDataJSON() ?? {};
    await new Promise((r) => setTimeout(r, 150));
    route.fulfill({ json: { text: translations.get(body.text) ?? body.text, detected_source: null, quota: { plan: 'pro_yearly', remaining: null } } });
  });
  await context.route('**/functions/v1/replan', (route) => route.fulfill({ json: replanResult(lang, TODAY) }));
  const tickets = parsedTickets(TRIP_DAYS[0], TRIP_DAYS[4]);
  let parseCalls = 0;
  await context.route('**/functions/v1/parse-document', (route) => {
    const doc = parseCalls++ % 2 === 0 ? tickets.flight : tickets.hotel;
    route.fulfill({ json: { document: { id: route.request().postDataJSON()?.document_id, parsed_data: doc } } });
  });
  await context.route('**/functions/v1/places', (route) => {
    if (route.request().postDataJSON()?.action !== 'weather') return route.continue();
    const days = TRIP_DAYS.map((date, i) => ({ date, city: itinerary(lang).trip, max: 23 - (i % 2), min: 14, condition: 'CLEAR', description: SUNNY[lang], iconUri: null, rainChance: 5 }));
    return route.fulfill({ json: { days, available_from: null } });
  });
  await context.route('**/storage/v1/object/**', (route) => route.fulfill({ json: { Key: 'documents/demo', Id: 'demo' } }));

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const base = `http://localhost:${PORT}`;
  const t = (key, vars) => tr(lang, key, vars);
  const text = (s) => page.getByText(s, { exact: true }).last();
  const settle = (ms = 1200) => page.waitForTimeout(ms);

  async function open(route, waitFor) {
    await page.goto(base + route, { waitUntil: 'networkidle' });
    if (waitFor) await text(waitFor).waitFor({ timeout: 20000 });
    await settle();
  }

  /** Metni içeren öğeyi kaydırılabilir kabın üstüne (offset px aşağıya) getirir. */
  async function scrollTo(s, offset = 12) {
    await page.evaluate(
      ([s, offset]) => {
        const els = [...document.querySelectorAll('div,span')].filter((e) => e.textContent?.trim() === s && e.children.length === 0);
        const el = els[els.length - 1];
        if (!el) return;
        let sc = el.parentElement;
        while (sc && !(sc.scrollHeight > sc.clientHeight + 4 && ['auto', 'scroll'].includes(getComputedStyle(sc).overflowY))) sc = sc.parentElement;
        if (!sc) return;
        sc.scrollTop += el.getBoundingClientRect().top - sc.getBoundingClientRect().top - offset;
      },
      [s, offset],
    );
    await settle(500);
  }

  const shots = {
    1: async () => {
      const it = itinerary(lang);
      await open(`/trip/${TRIP_ID}`, it.items[0].title);
      await scrollTo(t('plan.title'), 16);
    },
    2: async () => {
      // Kayıtlı plan telefondan okunurken ekran önce form olarak açılır; "Planıma dön".
      await open('/evening', t('city.backToPlan'));
      await text(t('city.backToPlan')).click();
      await text(evening.title).waitFor({ timeout: 10000 });
      await settle();
    },
    3: async () => {
      await open('/assistant', t('assistant.suggestionRain'));
      await text(t('assistant.suggestionRain')).click();
      await text(t('assistant.planUpdated')).waitFor({ timeout: 15000 });
      await settle();
    },
    4: () => open('/passport', t('passport.title')),
    5: () => open('/visited', t('visited.title')),
    6: async () => {
      await open('/translate', t('translate.title'));
      for (const turn of conv.turns) {
        await page.evaluate((s) => window.__speechQueue.push(s), turn.said);
        await page.getByLabel(templateRe(lang, turn.side === 'me' ? 'translate.speakMine' : 'translate.speakTheirs')).click();
        await text(turn.translated).waitFor({ timeout: 15000 });
      }
      await settle();
    },
    7: async () => {
      await open('/spin', t('spin.title'));
      await text(t('spin.spin')).click();
      await text(t('spin.sentMe')).waitFor({ timeout: 20000 });
      await settle(1500);
    },
    8: async () => {
      await open('/getaway', t('city.backToResults'));
      await text(t('city.backToResults')).click();
      await text(getaways(lang).getaways[0].why).waitFor({ timeout: 10000 });
      await settle();
    },
    9: async () => {
      await open('/ticket', t('ticket.title'));
      const chooser = page.waitForEvent('filechooser');
      await text(t('ticket.sourceFile')).click();
      await (await chooser).setFiles(ticketFiles);
      await text(t('ticket.read')).click();
      await page.getByText(t('ticket.statusDone', { count: 1 }), { exact: true }).waitFor({ timeout: 20000 });
      await page.getByText(t('ticket.statusDone', { count: 2 }), { exact: true }).waitFor({ timeout: 20000 });
      await settle();
    },
    10: () => open('/my-docs', t('docs.schengenToday')),
  };

  for (const s of SCREENS.filter((x) => onlyScreens.includes(x.n))) {
    const file = path.join(RAW, `${deviceKey}-${lang}-${String(s.n).padStart(2, '0')}.png`);
    try {
      await shots[s.n]();
      await page.screenshot({ path: file });
    } catch (e) {
      log(`HATA ${lang} ${deviceKey} ${s.slug}: ${e.message.split('\n')[0]}`);
      await page.screenshot({ path: file.replace('.png', '-error.png') }).catch(() => undefined);
    }
  }
  if (errors.length) log(`sayfa hataları ${lang} ${deviceKey}:`, errors.slice(0, 3).join(' | '));
  await context.close();
}

// ---------------------------------------------------------------------------
// 4. Birleştirme (marka arka planı + başlık + cihaz çerçevesi)
// ---------------------------------------------------------------------------
const STATUS_ICONS = `<svg viewBox="0 0 78 14" height="100%"><g fill="#fff"><rect x="0" y="9" width="3" height="5" rx="1"/><rect x="5" y="6" width="3" height="8" rx="1"/><rect x="10" y="3" width="3" height="11" rx="1"/><rect x="15" y="0" width="3" height="14" rx="1"/>
<path d="M32 3.2a10 10 0 0 1 13 0l-1.6 1.7a7.6 7.6 0 0 0-9.8 0zM34.6 6a6.2 6.2 0 0 1 7.8 0l-1.6 1.7a3.8 3.8 0 0 0-4.6 0zM38.5 12.6 36.4 10.4a3 3 0 0 1 4.2 0z"/>
<rect x="52" y="1" width="22" height="12" rx="3.5" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="1.4"/><rect x="54" y="3" width="16" height="8" rx="2"/><rect x="75.5" y="5" width="1.8" height="4" rx=".9" fill-opacity=".45"/></g></svg>`;

function composeHtml({ device, lang, caption, rawUrl, index }) {
  const [W, H] = device.canvas;
  const vw = device.viewport.width;
  const vh = device.viewport.height + device.statusBar;
  const bezel = device.kind === 'ipad' ? 26 : device.kind === 'iphone' ? 22 : 16;
  const maxW = W * (device.kind === 'ipad' ? 0.8 : 0.82);
  const maxH = H - device.caption.area - (device.kind === 'android' ? 70 : 110);
  const s = Math.min((maxW - 2 * bezel) / vw, (maxH - 2 * bezel) / vh);
  const screenW = Math.round(vw * s);
  const screenH = Math.round(vh * s);
  const sb = Math.round(device.statusBar * s);
  const radius = Math.round((device.kind === 'iphone' ? 58 : device.kind === 'ipad' ? 22 : 30) * s);
  const font = lang === 'ar' ? "'Kufi', 'DejaVu Sans', sans-serif" : lang === 'zh' ? "'NotoSC', 'WenQuanYi Zen Hei', sans-serif" : "'Unbounded', 'Inter', sans-serif";
  const size = device.caption.size * (lang === 'zh' ? 1.08 : lang === 'ar' ? 1.05 : 1);
  const glow = [
    ['12% 8%', '88% 72%'],
    ['85% 10%', '15% 80%'],
    ['50% 0%', '90% 90%'],
  ][index % 3];
  const island =
    device.kind === 'iphone'
      ? `<div style="position:absolute;top:${Math.round(11 * s)}px;left:50%;transform:translateX(-50%);width:${Math.round(124 * s)}px;height:${Math.round(36 * s)}px;border-radius:999px;background:#000"></div>`
      : device.kind === 'android'
        ? `<div style="position:absolute;top:${Math.round(9 * s)}px;left:50%;transform:translateX(-50%);width:${Math.round(13 * s)}px;height:${Math.round(13 * s)}px;border-radius:999px;background:#000"></div>`
        : '';
  const clockSize = Math.round((device.kind === 'ipad' ? 13 : device.kind === 'android' ? 13 : 16.5) * s);
  const pad = Math.round((device.kind === 'iphone' ? 34 : 20) * s);
  return `<!doctype html><html lang="${lang}" dir="${lang === 'ar' ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><style>
@font-face{font-family:'Unbounded';src:url('/__unbounded/700Bold/Unbounded_700Bold.ttf')}
@font-face{font-family:'Kufi';src:url('/__fonts/NotoKufiArabic-ExtraBold.ttf')}
@font-face{font-family:'NotoSC';src:url('/__fonts/NotoSansSC-Black-subset.ttf')}
*{box-sizing:border-box;margin:0}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:#070B16}
.bg{position:absolute;inset:0;background:
 radial-gradient(60% 40% at ${glow[0]}, rgba(255,107,74,.42), transparent 70%),
 radial-gradient(55% 45% at ${glow[1]}, rgba(124,92,255,.40), transparent 70%),
 radial-gradient(40% 30% at 50% 100%, rgba(46,230,201,.18), transparent 70%),
 linear-gradient(180deg,#0C1222 0%,#070B16 60%,#04060C 100%)}
.grid{position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);background-size:${Math.round(W / 12)}px ${Math.round(W / 12)}px;mask-image:linear-gradient(180deg,#000 0%,transparent 55%)}
.cap{position:absolute;left:6%;right:6%;top:${device.caption.top}px;height:${device.caption.area - device.caption.top - 40}px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.cap h1{font-family:${font};font-weight:${lang === 'zh' ? 900 : 700};font-size:${size}px;line-height:1.18;color:#fff;letter-spacing:${lang === 'ar' || lang === 'zh' ? 0 : -0.01}em;text-wrap:balance;${lang === 'zh' ? 'word-break:keep-all;' : ''}text-shadow:0 6px 40px rgba(255,61,127,.35)}
.bar{width:${Math.round(W * 0.12)}px;height:${Math.round(size * 0.09)}px;border-radius:99px;margin-top:${Math.round(size * 0.35)}px;background:linear-gradient(90deg,#FF7A45,#FF3D7F,#7C5CFF)}
.device{position:absolute;left:50%;top:${device.caption.area}px;transform:translateX(-50%);padding:${bezel}px;border-radius:${radius + bezel}px;
 background:linear-gradient(145deg,#2a3150,#0b0f1c 40%,#1a2036);box-shadow:0 0 0 2px rgba(255,255,255,.10) inset,0 40px 120px rgba(0,0,0,.65),0 0 140px rgba(255,61,127,.20)}
.screen{position:relative;width:${screenW}px;height:${screenH}px;border-radius:${radius}px;overflow:hidden;background:#070B16}
.status{height:${sb}px;display:flex;align-items:center;justify-content:space-between;padding:0 ${pad}px;color:#fff;font:600 ${clockSize}px Inter,sans-serif;direction:ltr}
.status .icons{height:${Math.round(clockSize * 0.78)}px}
.shot{display:block;width:${screenW}px;height:${screenH - sb}px}
</style></head><body><div class="bg"></div><div class="grid"></div>
<div class="cap"><h1>${caption}</h1><div class="bar"></div></div>
<div class="device"><div class="screen"><div class="status"><span>9:41</span><span class="icons">${STATUS_ICONS}</span></div>${island}<img class="shot" src="${rawUrl}"></div></div>
</body></html>`;
}

/**
 * pngquant (libimagequant) dosyaları ~4 kat küçültür ve gradyanlarda bant oluşturmaz.
 * PATH'te yoksa npx ile geçici olarak indirilir (projeye bağımlılık eklenmez).
 */
let pngquantBin;
function pngquant() {
  if (pngquantBin !== undefined) return pngquantBin;
  const which = (cmd, args) => spawnSync(cmd, args, { encoding: 'utf8' }).stdout?.trim().split('\n').pop() || null;
  pngquantBin = process.env.PNGQUANT || which('sh', ['-c', 'command -v pngquant']) || which('npx', ['--yes', '-p', 'pngquant-bin@9.0.0', 'sh', '-c', 'command -v pngquant']);
  if (!pngquantBin) log('UYARI: pngquant bulunamadı, PNG dosyaları sıkıştırılmadan kaydedilecek');
  return pngquantBin;
}

function optimize(file) {
  const bin = pngquant();
  if (bin) spawnSync(bin, ['--quality', '70-95', '--speed', '1', '--strip', '--skip-if-larger', '--force', '--ext', '.png', file]);
}

async function compose(browser, deviceKey, lang) {
  const device = DEVICES[deviceKey];
  const [W, H] = device.canvas;
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const dir = path.join(HERE, device.dir, LOCALES[lang][device.locale]);
  fs.mkdirSync(dir, { recursive: true });
  for (const s of SCREENS.filter((x) => onlyScreens.includes(x.n))) {
    const nn = String(s.n).padStart(2, '0');
    const raw = `${deviceKey}-${lang}-${nn}.png`;
    if (!fs.existsSync(path.join(RAW, raw))) continue;
    const html = composeHtml({ device, lang, caption: CAPTIONS[lang][s.n - 1], rawUrl: `/__raw/${raw}`, index: s.n });
    fs.writeFileSync(path.join(WORK, 'compose.html'), html);
    await page.goto(`http://localhost:${PORT}/__work/compose.html`, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(150);
    const out = path.join(dir, `${nn}-${s.slug}.png`);
    await page.screenshot({ path: out, type: 'png' });
    optimize(out);
  }
  await page.close();
}

// ---------------------------------------------------------------------------
async function main() {
  const dist = opt('dist') ?? build();
  seed();
  const session = await getSession();
  const server = await serve(dist);
  const browser = await chromium.launch(fs.existsSync('/opt/pw-browsers/chromium') && !process.env.PLAYWRIGHT_BROWSERS_PATH ? { executablePath: '/opt/pw-browsers/chromium' } : {});
  try {
    const ticketFiles = await makeTicketImages(browser);
    for (const lang of onlyLangs) {
      localizeDb(lang);
      for (const deviceKey of onlyDevices) {
        log(`${lang} · ${deviceKey}`);
        await captureLanguage(browser, lang, deviceKey, session, ticketFiles);
        await compose(browser, deviceKey, lang);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
  log('bitti →', path.relative(ROOT, HERE), opt('raw') ? '' : `(ham görüntüler: ${RAW})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
