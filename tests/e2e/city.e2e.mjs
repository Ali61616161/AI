#!/usr/bin/env node
// Uçtan uca test: Şehrim. Yaşanan şehir yoksa plan istenemez; akşam planındaki mekanlar
// Google ile doğrulanır, şehir koordinatı bir kez bulunup profile yazılır; kaçamaklar
// gerçek koordinatla elenir (bulunamayan ve çok uzak yer çıkar) ve bütçeye göre sıralanır;
// ücretsiz planda ikisi de haftada bir.
//
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/city.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
assert.ok(ANON, 'ANON_KEY gerekli');

let token = ANON;
async function call(path, body, method = 'POST') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const city = (body) => call('/functions/v1/city', body);

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}

let userId;
await step('Yaşanan şehir olmadan plan istenemez', async () => {
  const r = await call('/auth/v1/verify', { email: `city-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  token = r.data.access_token;
  userId = r.data.user.id;
  const res = await city({ action: 'evening', when: 'tonight', companion: 'couple', budget: 'mid' });
  assert.equal(res.status, 400);
  assert.equal(res.data.error.message, 'no_home_city');
});

await step('Akşam planı: mekanlar doğrulanır, şehir koordinatı profile yazılır', async () => {
  const up = await call(`/rest/v1/profiles?id=eq.${userId}`, { home_city: 'Roma', home_country: 'IT', passport_country: 'TR', extra_visas: ['schengen_visa'] }, 'PATCH');
  assert.equal(up.status, 200, JSON.stringify(up.data));
  const r = await city({ action: 'evening', when: 'tonight', companion: 'couple', budget: 'mid', moods: ['romantic', 'fake'], timezone: 'Europe/Rome' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.city, 'Roma');
  assert.equal(r.data.currency, 'EUR', 'İtalya için euro');
  assert.match(r.data.summary, /romantic/);
  assert.doesNotMatch(r.data.summary, /fake/, 'bilinmeyen ruh hali gönderilmemeli');
  const dinner = r.data.stops.find((s) => s.title === 'TEST dinner');
  assert.equal(dinner.google_place_id, 'fake-test-trattoria');
  assert.ok(dinner.rating && dinner.maps_url && dinner.lat);
  assert.equal(r.data.stops.find((s) => s.place_name === 'Nowhere Lane').google_place_id, null, 'bulunamayan mekan doğrulanmış sayılmamalı');
  const { data: [p] } = await call(`/rest/v1/profiles?id=eq.${userId}&select=home_lat,home_lng`, undefined, 'GET');
  assert.ok(Math.abs(Number(p.home_lat) - 41.9) < 0.02 && Math.abs(Number(p.home_lng) - 12.49) < 0.02, `koordinat ${p.home_lat},${p.home_lng}`);
  assert.equal(Number(p.home_lat), Math.round(Number(p.home_lat) * 100) / 100, '~1 km hassasiyet');
});

await step('Ücretsiz planda haftada bir akşam planı', async () => {
  const r = await city({ action: 'evening', when: 'weekend', companion: 'friends', budget: 'low' });
  assert.equal(r.status, 402);
});

await step('Kaçamak: bulunamayan ve çok uzak yer elenir, bütçeye uyanlar ucuzdan pahalıya', async () => {
  assert.equal((await city({ action: 'getaways', days: 9, budget_per_person: 100 })).status, 400);
  const r = await city({ action: 'getaways', days: 1, budget_per_person: 100, transport: 'public', companion: 'friends' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.deepEqual(r.data.getaways.map((g) => g.city), ['Tivoli', 'Orvieto', 'Napoli'], 'Atlantis (bulunamadı) ve Milano (günübirlik için uzak) çıkmalı');
  const tivoli = r.data.getaways[0];
  assert.equal(tivoli.total, 40);
  assert.ok(tivoli.distanceKm > 20 && tivoli.distanceKm < 40, `Tivoli ~28 km, gelen ${tivoli.distanceKm}`);
  assert.match(tivoli.directionsUrl, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&origin=Roma%2C%20IT&destination=Tivoli%2C%20IT&travelmode=transit$/);
  assert.equal((await city({ action: 'getaways', days: 2, budget_per_person: 300 })).status, 402, 'ücretsizde haftada bir kaçamak araması');
});

await step('Kayıtlı yerler ve şehir pasaportu', async () => {
  assert.equal((await call('/rest/v1/saved_places', { google_place_id: 'fake-test-trattoria', name: 'TEST Trattoria', category: 'restaurant' })).status, 201);
  assert.equal((await call('/rest/v1/saved_places', { list_name: 'date', google_place_id: 'x', name: 'X' })).status >= 400, true, 'ücretsizde ikinci liste olmamalı');
  assert.equal((await call('/rest/v1/place_visits', { google_place_id: 'fake-test-trattoria', name: 'TEST Trattoria', category: 'restaurant', city: 'Roma' })).status, 201);
  const s = await call('/rest/v1/rpc/city_passport_stats', {});
  assert.equal(s.data[0].places, 1);
  assert.equal(s.data[0].week_streak, 1);
});

console.log(`\n${steps.length} adım geçti.`);
