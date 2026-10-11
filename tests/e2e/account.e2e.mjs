#!/usr/bin/env node
// Uçtan uca test: şifreyle giriş (inceleme hesabı), elle seyahat oluşturma ve hesap
// silme (tüm veriler gider). Yerel geçitte şifre LOCAL_REVIEW_PASSWORD'dur.
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/account.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
assert.ok(ANON, 'ANON_KEY gerekli');

let token = ANON;
async function call(path, body, method = 'POST') {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}
const isoDate = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const email = `review-${Date.now()}@yola.local`;
let userId;
let tripId;

await step('Şifreyle giriş: yanlış şifre reddedilir, doğru şifre oturum açar', async () => {
  assert.equal((await call('/auth/v1/token?grant_type=password', { email, password: 'wrong' })).status, 400);
  const r = await call('/auth/v1/token?grant_type=password', { email, password: 'yola-review-123' });
  assert.equal(r.status, 200);
  token = r.data.access_token;
  userId = r.data.user.id;
});

await step('Elle seyahat: bilet olmadan şehir ve tarihlerle; geçersiz tarih reddedilir', async () => {
  const bad = await call('/rest/v1/rpc/create_trip_manual', { p_title: 'X', p_start: isoDate(5), p_end: isoDate(2), p_destinations: [{ city: 'Lisboa', country_code: 'PT' }] });
  assert.notEqual(bad.status, 200);
  const r = await call('/rest/v1/rpc/create_trip_manual', { p_title: 'Lizbon', p_start: isoDate(5), p_end: isoDate(8), p_destinations: [{ city: 'Lisboa', country_code: 'pt' }], p_interests: ['food'] });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  tripId = r.data;
  const { data } = await call(`/rest/v1/trips?id=eq.${tripId}&select=title,status,trip_destinations(city,country_code,arrive_on,depart_on)`, undefined, 'GET');
  assert.equal(data[0].status, 'planned');
  assert.deepEqual(data[0].trip_destinations[0], { city: 'Lisboa', country_code: 'PT', arrive_on: isoDate(5), depart_on: isoDate(8) });
  const gen = await call('/functions/v1/generate-itinerary', { trip_id: tripId });
  assert.equal(gen.status, 200, 'rezervasyonsuz seyahatte de rota üretilmeli');
});

await step('Hesap silme: onay gerekir; silinince tüm veriler gider ve oturum geçersizleşir', async () => {
  assert.equal((await call('/functions/v1/delete-account', {})).status, 400);
  const r = await call('/functions/v1/delete-account', { confirm: 'DELETE' });
  assert.equal(r.status, 204, JSON.stringify(r.data));
  const trips = await call(`/rest/v1/trips?id=eq.${tripId}&select=id`, undefined, 'GET');
  assert.deepEqual(trips.data, []);
  const again = await call('/functions/v1/generate-itinerary', { trip_id: tripId });
  assert.ok(again.status === 401 || again.status === 404, String(again.status));
  // Aynı e-postayla yeniden giriş yeni (boş) bir hesap açar.
  const fresh = await call('/auth/v1/token?grant_type=password', { email, password: 'yola-review-123' });
  assert.notEqual(fresh.data.user.id, userId);
});

console.log(`\n${steps.length} adım geçti.`);
