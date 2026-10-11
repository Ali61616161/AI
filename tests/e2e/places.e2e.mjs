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

await step('Ücretsiz planda günde 10 yakın arama; 11. reddedilir', async () => {
  // 1 açık yer + 1 otel araması yapıldı; 8 tane daha izinli.
  for (let i = 0; i < 8; i++) assert.equal((await places({ action: 'open_now', ...ROME, category: 'museum' })).status, 200);
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
