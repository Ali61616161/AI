#!/usr/bin/env node
// Uçtan uca test: yakında şu an açık yerler, otel önerileri, hava durumu ve yakın
// arama kotası. Yerel ortamda (scripts/local-stack/start.sh, FAKE_GEMINI=1) Google
// yerine test ikizi (fake-google.mjs) çalışır; ikiz istekleri resmi şemayla doğrular.
//
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/places.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
const FAKE_GOOGLE = process.env.FAKE_GOOGLE_URL ?? 'http://127.0.0.1:54341';
assert.ok(ANON, 'ANON_KEY gerekli');

let token = ANON;
async function call(path, body, method = 'POST', extra = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...extra },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const places = (body) => call('/functions/v1/places', body);
const isoDate = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}

const ROME = { lat: 41.9, lng: 12.48 };
let tripId;

await step('Giriş yapılmadan reddedilir', async () => {
  assert.equal((await places({ action: 'open_now', ...ROME, category: 'cafe' })).status, 401);
});

await step('Giriş ve 2 şehirli seyahat (yarın Roma, 3 gün sonra Floransa)', async () => {
  const r = await call('/auth/v1/verify', { email: `places-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  token = r.data.access_token;
  const user = (await call('/auth/v1/user', undefined, 'GET')).data;
  const doc = await call('/rest/v1/documents', { storage_path: `${user.id}/p.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  const t = await call('/rest/v1/rpc/create_trip_from_documents', {
    p_trip: { title: 'Places E2E', start_date: isoDate(1), end_date: isoDate(4), budget_tier: 'lux', companion_type: 'couple', interests: [] },
    p_destinations: [
      { city: 'Rome', country_code: 'IT', arrive_on: isoDate(1), depart_on: isoDate(3) },
      { city: 'Florence', country_code: 'IT', arrive_on: isoDate(3), depart_on: isoDate(4) },
    ],
    p_reservations: [
      { document_id: doc.data[0].id, type: 'train', title: 'Roma → Firenze', starts_at: `${isoDate(3)}T09:00:00Z`, start_timezone: 'Europe/Rome', end_timezone: 'Europe/Rome' },
    ],
    p_document_ids: [doc.data[0].id],
  });
  assert.equal(t.status, 200, JSON.stringify(t.data));
  tripId = t.data;
});

await step('Yakında şu an açık: sadece açık yerler, mesafeyle', async () => {
  const r = await places({ action: 'open_now', ...ROME, category: 'cafe' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.places.map((p) => p.name), ['TEST open cafe 1', 'TEST open cafe 2']);
  assert.ok(r.data.places.every((p) => p.distanceM > 0 && p.rating > 4 && p.mapsUrl.startsWith('https://')));
  assert.equal(r.data.quota.remaining, 9);
});

await step('Kararsızım ve harita: yeni kategoriler, geniş alan ve 20 sonuç', async () => {
  const r = await places({ action: 'open_now', ...ROME, category: 'dessert', radius: 3000, limit: 20 });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const calls = await (await fetch(`${FAKE_GOOGLE}/calls`)).json();
  const last = calls.filter((c) => c.api === 'places').at(-1).body;
  assert.equal(last.includedType, 'dessert_shop');
  assert.equal(last.pageSize, 20);
  assert.equal(last.locationBias.circle.radius, 3000);
  // Sınırlar: yarıçap 300-5000 m, sonuç 10 veya 20.
  await places({ action: 'open_now', ...ROME, category: 'park', radius: 99999, limit: 500 });
  const clamped = (await (await fetch(`${FAKE_GOOGLE}/calls`)).json()).filter((c) => c.api === 'places').at(-1).body;
  assert.equal(clamped.locationBias.circle.radius, 5000);
  assert.equal(clamped.pageSize, 10);
});

await step('Geçersiz kategori ve konum reddedilir (kota harcanmaz)', async () => {
  assert.equal((await places({ action: 'open_now', ...ROME, category: 'casino' })).status, 400);
  assert.equal((await places({ action: 'open_now', lat: 200, lng: 0, category: 'cafe' })).status, 400);
});

await step('Otel önerileri: lüks bütçe, Booking bağlantısı tarih ve kişiyle, kapalı otel elenir', async () => {
  const r = await places({ action: 'hotels', trip_id: tripId });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.city, 'Rome');
  assert.deepEqual(r.data.places.map((p) => p.name), ['TEST Hotel Centro', 'TEST Hotel Stazione']);
  const url = new URL(r.data.places[0].booking_url);
  assert.equal(url.hostname, 'www.booking.com');
  assert.equal(url.searchParams.get('checkin'), isoDate(1));
  assert.equal(url.searchParams.get('checkout'), isoDate(3));
  assert.equal(url.searchParams.get('group_adults'), '2');
  const calls = await (await fetch(`${FAKE_GOOGLE}/calls`)).json();
  const hotelCall = calls.filter((c) => c.api === 'places' && c.body.includedType === 'lodging').at(-1);
  assert.equal(hotelCall.body.textQuery, 'luxury hotel in Rome');
  assert.equal(hotelCall.body.minRating, 4.5);
  assert.ok(hotelCall.body.locationBias, 'şehir merkezine göre aranmalı');
});

await step('Hava durumu: her gün kendi şehriyle, Google şemasına uygun isteklerle', async () => {
  const r = await places({ action: 'weather', trip_id: tripId });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.days.map((d) => [d.date, d.city]), [
    [isoDate(1), 'Rome'],
    [isoDate(2), 'Rome'],
    [isoDate(3), 'Florence'],
    [isoDate(4), 'Florence'],
  ]);
  assert.ok(r.data.days.every((d) => typeof d.max === 'number' && d.condition));
  const calls = await (await fetch(`${FAKE_GOOGLE}/calls`)).json();
  assert.deepEqual(calls.filter((c) => c.errors.length), [], "Google'a şemada olmayan alan gönderilmemeli");
});

await step('Nasıl giderim: tren ve feribot adımları, işletmeci sitesi, feribota bilet bağlantısı', async () => {
  const r = await places({ action: 'route', origin: { lat: 46.69, lng: 7.86 }, destination: { address: 'Spiez' }, origin_name: 'Interlaken', destination_name: 'Spiez', country_code: 'ch' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const [route] = r.data.routes;
  assert.equal(route.durationMin, 90);
  assert.deepEqual(route.fare, { amount: 34, currency: 'CHF' });
  assert.deepEqual(route.steps.map((s) => s.transit?.vehicle ?? s.mode), ['walk', 'train', 'ferry']);
  assert.equal(route.steps[1].transit.agencyUrl, 'https://www.jungfrau.ch/');
  assert.deepEqual(route.steps[1].tickets, [], 'bölgesel trene bilet bağlantısı gerekmez');
  assert.equal(route.steps[2].tickets[0].partner, 'rome2rio');
  assert.equal(route.steps[2].tickets[0].mode, 'ferry');
  assert.match(r.data.navigation_url, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=Spiez&travelmode=transit&origin=46\.69%2C7\.86$/);
  const call = (await (await fetch(`${FAKE_GOOGLE}/calls`)).json()).filter((c) => c.api === 'routes').at(-1);
  assert.deepEqual(call.errors, []);
  assert.equal(call.body.travelMode, 'TRANSIT');
});

await step('Toplu taşıma yoksa yolculuk bilet seçenekleri (uçak, tren) ve araba güzergahı', async () => {
  const r = await places({ action: 'route', origin: { address: 'Istanbul' }, destination: { address: 'Test Island' }, mode: 'transit' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.routes, []);
  assert.ok(r.data.tickets.length >= 1 && r.data.tickets.every((t) => t.url.startsWith('https://')));
  assert.ok(r.data.tickets.some((t) => t.partner === 'rome2rio'));
  const car = await places({ action: 'route', origin: { address: 'Istanbul' }, destination: { address: 'Sile' }, mode: 'drive' });
  assert.equal(car.status, 200);
  assert.deepEqual([car.data.routes[0].durationMin, car.data.routes[0].steps.length], [45, 0]);
  assert.equal((await places({ action: 'route', origin: { lat: 999, lng: 0 }, destination: { address: 'x' } })).status, 400);
});

await step('Ücretsiz planda günde 10 yakın arama; 11. reddedilir', async () => {
  // 3 açık yer + 1 otel araması yapıldı; 6 tane daha izinli.
  for (let i = 0; i < 6; i++) assert.equal((await places({ action: 'open_now', ...ROME, category: 'museum' })).status, 200);
  const r = await places({ action: 'open_now', ...ROME, category: 'museum' });
  assert.equal(r.status, 402);
  assert.equal(r.data.error.code, 'quota_exceeded');
});

await step('Başka kullanıcı bu seyahatin otel ve hava bilgisini göremez', async () => {
  const other = await call('/auth/v1/verify', { email: `places-other-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  token = other.data.access_token;
  assert.equal((await places({ action: 'hotels', trip_id: tripId })).status, 404);
  assert.equal((await places({ action: 'weather', trip_id: tripId })).status, 404);
});

console.log(`\n${steps.length} adım geçti.`);
