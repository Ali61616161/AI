#!/usr/bin/env node
// Uçtan uca test: yerel ortamda (scripts/local-stack/start.sh, FAKE_GEMINI=1) gerçek
// giriş, PostgREST, RLS, veritabanı fonksiyonları ve Edge Function'larla rota
// üretme, Planı Değiştir, geri alma ve tarih değişikliğini dener. AI cevapları test
// ikizinden gelir; AI dışındaki her şey gerçektir.
//
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/replan.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
assert.ok(ANON, 'ANON_KEY gerekli');

let token = ANON;
const headers = () => ({ apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json' });

async function call(path, body, method = 'POST', extra = {}) {
  const res = await fetch(`${BASE}${path}`, { method, headers: { ...headers(), ...extra }, body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const rpc = (name, args) => call(`/rest/v1/rpc/${name}`, args);
const get = (path) => call(`/rest/v1/${path}`, undefined, 'GET');

/** Roma'da bugünün tarihi ve offset gün eklenmiş tarih. */
function romeDate(offset = 0) {
  const d = new Date(Date.now() + offset * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(d);
}

async function activePlan(tripId) {
  const { data } = await get(
    `plan_versions?trip_id=eq.${tripId}&is_active=eq.true&select=id,version,reason,user_prompt,day_plans(date,plan_items(title,starts_at,is_locked,kind,google_place_id,rating,lat,lng,maps_url,booking_url,place_checked_at))`,
  );
  const plan = data[0];
  plan.day_plans.sort((a, b) => a.date.localeCompare(b.date));
  return plan;
}

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}

const start = romeDate(-1);
const today = romeDate(0);
const end = romeDate(2);
let tripId;
let firstPlan;

await step('Giriş yapılmadan fonksiyon çağrısı reddedilir', async () => {
  const r = await call('/functions/v1/replan', { mode: 'crisis', message: 'x' });
  assert.equal(r.status, 401);
});

await step('E-posta kodu ile giriş', async () => {
  const r = await call('/auth/v1/verify', { email: `e2e-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  assert.equal(r.status, 200);
  token = r.data.access_token;
});

await step('Belgeden seyahat oluşturma (dün → 2 gün sonra, otel + dönüş uçuşu)', async () => {
  const user = (await call('/auth/v1/user', undefined, 'GET')).data;
  const doc = await call('/rest/v1/documents', { storage_path: `${user.id}/e2e.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  assert.equal(doc.status, 201);
  const r = await rpc('create_trip_from_documents', {
    p_trip: { title: 'E2E Roma', start_date: start, end_date: end, budget_tier: 'low', companion_type: 'solo', interests: ['art'] },
    p_destinations: [{ city: 'Rome', country_code: 'IT', arrive_on: start, depart_on: end }],
    p_reservations: [
      { document_id: doc.data[0].id, type: 'hotel', title: 'E2E Hotel', starts_at: `${start}T13:00:00Z`, ends_at: `${end}T09:00:00Z`, start_timezone: 'Europe/Rome', end_timezone: 'Europe/Rome' },
      { document_id: doc.data[0].id, type: 'flight', title: 'E2E Flight home', starts_at: `${end}T16:00:00Z`, start_timezone: 'Europe/Rome', end_timezone: 'Europe/Istanbul' },
    ],
    p_document_ids: [doc.data[0].id],
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  tripId = r.data;
});

await step('AI rota: ücretsiz planda ilk 3 gün, otel girişi kilitli durak', async () => {
  const r = await call('/functions/v1/generate-itinerary', { trip_id: tripId });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.days_planned, 3);
  assert.equal(r.data.days_total, 4);
  assert.equal(r.data.truncated, true);
  firstPlan = await activePlan(tripId);
  assert.equal(firstPlan.version, 1);
  assert.equal(firstPlan.day_plans.length, 3);
  const day1 = firstPlan.day_plans[0].plan_items;
  assert.ok(day1.some((i) => i.is_locked && i.title === 'E2E Hotel'), 'otel girişi kilitli durak olmalı');
  assert.ok(day1.some((i) => i.title === `TEST museum ${start}`));
});

await step('Mekan doğrulama: bulunan mekanlara Google kimliği, konum, puan ve bilet bağlantısı eklenir', async () => {
  const items = firstPlan.day_plans.flatMap((d) => d.plan_items);
  const museum = items.find((i) => i.title === `TEST museum ${start}`);
  assert.equal(museum.google_place_id, 'fake-test-musei-vaticani');
  assert.equal(museum.rating, 4.6);
  assert.ok(museum.lat > 41 && museum.lng > 12, 'koordinat kaydedilmeli');
  assert.match(museum.maps_url, /^https:\/\/maps\.google\.com\//);
  assert.match(museum.booking_url, /^https:\/\/www\.tiqets\.com\/.*q=TEST/);
  assert.ok(museum.place_checked_at);
  const walk = items.find((i) => i.title === `TEST walk ${start}`);
  assert.equal(walk.google_place_id, null, 'Google\'da bulunamayan mekan doğrulanmış sayılmamalı');
  const hotel = items.find((i) => i.title === 'E2E Hotel');
  assert.equal(hotel.google_place_id, null, 'kilitli rezervasyonlar sorgulanmaz');
  const { data: dest } = await get(`trip_destinations?trip_id=eq.${tripId}&select=city,lat,lng`);
  assert.ok(dest[0].lat > 41, 'şehir koordinatı bir kez bulunup kaydedilmeli');
});

let crisisVersion;
await step('Planı Değiştir (yağmur): bugünün kalanı değişir, geçmiş ve diğer günler korunur', async () => {
  const r = await call('/functions/v1/replan', {
    mode: 'crisis', trip_id: tripId, message: 'Yağmur başladı, kapalı bir yer bul', location: { lat: 41.9, lng: 12.48 }, timezone: 'Europe/Rome',
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.match(r.data.reply, /TEST reply/);
  assert.match(r.data.reply, /TEST rain, 12°C/, 'anlık hava asistana verilmeli');
  const cafe = r.data.suggestions.find((x) => x.title === 'TEST cafe');
  assert.equal(cafe.google_place_id, 'fake-test-caff-roma');
  assert.ok(cafe.rating && cafe.maps_url, 'öneriler doğrulanmış mekan bilgisiyle gelmeli');
  assert.equal(r.data.date, today);
  assert.ok(r.data.plan_version_id, 'bugünün planı olduğu için plan değişmeli');
  assert.equal(r.data.previous_version_id, firstPlan.id);
  crisisVersion = r.data.plan_version_id;

  const plan = await activePlan(tripId);
  assert.equal(plan.reason, 'crisis');
  assert.equal(plan.user_prompt, 'Yağmur başladı, kapalı bir yer bul');
  const now = new Date().toISOString();
  const before = firstPlan.day_plans.find((d) => d.date === today).plan_items;
  const after = plan.day_plans.find((d) => d.date === today).plan_items;
  for (const past of before.filter((i) => i.starts_at < now || i.is_locked)) {
    assert.ok(after.some((i) => i.title === past.title), `korunmalı: ${past.title}`);
  }
  for (const future of before.filter((i) => i.starts_at >= now && !i.is_locked)) {
    assert.ok(!after.some((i) => i.title === future.title), `değişmeli: ${future.title}`);
  }
  assert.ok(after.some((i) => i.title === 'TEST indoor gallery'));
  const other = (p) => p.day_plans.filter((d) => d.date !== today).map((d) => d.plan_items.map((i) => i.title).sort());
  assert.deepEqual(other(plan), other(firstPlan), 'diğer günler aynen kalmalı');
});

await step('Geri al: önceki sürüm tekrar aktif', async () => {
  const r = await rpc('restore_plan_version', { p_version_id: firstPlan.id });
  assert.equal(r.status, 204);
  assert.equal((await activePlan(tripId)).id, firstPlan.id);
});

let shortened;
await step('Kısaltma (2 gün): dönüş uçuşu tarih dışında uyarısı, öne çıkanlar bildirilir', async () => {
  const r = await call('/functions/v1/replan', { mode: 'dates', trip_id: tripId, new_start: start, new_end: today });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.analysis.removedDates, [romeDate(1), end]);
  assert.ok(r.data.analysis.reservationsOutside.some((x) => x.title === 'E2E Flight home'));
  assert.ok(r.data.analysis.removedHighlights.some((x) => x.title === `TEST museum ${romeDate(1)}`));
  assert.ok(r.data.removed.length > 0);
  assert.ok(!r.data.removed.some((x) => x.title === 'E2E Hotel'), 'rezervasyonlar "plandan çıkanlar" listesinde olmamalı');
  const { data: trip } = await get(`trips?id=eq.${tripId}&select=start_date,end_date`);
  assert.deepEqual(trip[0], { start_date: start, end_date: today });
  shortened = await activePlan(tripId);
  assert.equal(shortened.reason, 'dates_changed');
  assert.equal(shortened.day_plans.length, 2);
  const { data: reservations } = await get(`reservations?trip_id=eq.${tripId}&select=id`);
  assert.equal(reservations.length, 2, 'rezervasyonlar silinmemeli');
});

await step('Uzatma (4 gün): mevcut günler aynen kalır, sadece yeni gün planlanır (ücretsizde ilk 3)', async () => {
  const r = await call('/functions/v1/replan', { mode: 'dates', trip_id: tripId, new_start: start, new_end: end });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.analysis.addedDates, [romeDate(1), end]);
  const plan = await activePlan(tripId);
  assert.equal(plan.day_plans.length, 3);
  const titles = (p, date) => p.day_plans.find((d) => d.date === date)?.plan_items.map((i) => i.title).sort();
  assert.deepEqual(titles(plan, start), titles(shortened, start));
  assert.deepEqual(titles(plan, today), titles(shortened, today));
  assert.ok(titles(plan, romeDate(1)).includes(`TEST museum ${romeDate(1)}`));
});

await step('Ücretsiz planda seyahat başına 3 yeniden planlama; 4. reddedilir', async () => {
  const r = await call('/functions/v1/replan', { mode: 'crisis', trip_id: tripId, message: 'Tren rötar yaptı', timezone: 'Europe/Rome' });
  assert.equal(r.status, 402, JSON.stringify(r.data));
  assert.equal(r.data.error.code, 'quota_exceeded');
});

await step('Seyahat olmadan: sadece cevap ve öneriler, plan değişmez', async () => {
  const r = await call('/functions/v1/replan', { mode: 'crisis', message: 'Yakında kahve?', timezone: 'Europe/Rome' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.plan_version_id, null);
  assert.ok(r.data.suggestions.length > 0);
});

await step('Başka kullanıcı bu seyahati yeniden planlayamaz', async () => {
  const other = await call('/auth/v1/verify', { email: `e2e-other-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  token = other.data.access_token;
  const r = await call('/functions/v1/replan', { mode: 'dates', trip_id: tripId, new_start: start, new_end: today });
  assert.equal(r.status, 404);
});

console.log(`\n${steps.length} adım geçti.`);
