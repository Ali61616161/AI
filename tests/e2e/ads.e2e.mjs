#!/usr/bin/env node
// Uçtan uca test: ödüllü reklam. Günlük hak dolunca Google'ın imzalı sunucu
// doğrulaması (SSV) ad-reward fonksiyonuna ulaşırsa +1 hak verilir. Yerelde Google
// yerine test ikizi (fake-google.mjs) gerçek Google gibi ECDSA ile imzalar.
//
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/ads.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
const FAKE_GOOGLE = process.env.FAKE_GOOGLE_URL ?? 'http://127.0.0.1:54341';
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
const places = (body) => call('/functions/v1/places', body);

/** Google'ın göndereceği imzalı geri çağrıyı üretip ad-reward'a yollar (oturumsuz GET). */
async function reward({ userId, feature = 'nearby_search', tx = `tx-${Math.random()}`, tamper = false }) {
  const q = new URLSearchParams({ ad_network: '5450213213286189855', ad_unit: '1234', custom_data: feature, reward_amount: '1', reward_item: 'credit', timestamp: String(Date.now()), transaction_id: tx, user_id: userId });
  let { query } = await (await fetch(`${FAKE_GOOGLE}/__admob/sign?query=${encodeURIComponent(q.toString())}`)).json();
  if (tamper) query = query.replace('custom_data=nearby_search', 'custom_data=travel_info');
  const res = await fetch(`${BASE}/functions/v1/ad-reward?${query}`);
  return { status: res.status, data: await res.json() };
}

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}

const ROME = { lat: 41.9, lng: 12.48 };
let userId;

await step('Ücretsiz kullanıcı günlük 10 yakın aramayı bitirir', async () => {
  const r = await call('/auth/v1/verify', { email: `ads-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  token = r.data.access_token;
  userId = r.data.user.id;
  for (let i = 0; i < 10; i++) assert.equal((await places({ action: 'open_now', ...ROME, category: 'cafe' })).status, 200);
  assert.equal((await places({ action: 'open_now', ...ROME, category: 'cafe' })).status, 402);
});

await step('İmzasız, sahte veya değiştirilmiş istek hak vermez', async () => {
  assert.equal((await fetch(`${BASE}/functions/v1/ad-reward?ad_network=1&transaction_id=x&user_id=${userId}&custom_data=nearby_search&timestamp=${Date.now()}&signature=AAAA&key_id=3335741209`)).status, 401);
  assert.equal((await reward({ userId, tamper: true })).status, 401);
  assert.equal((await places({ action: 'open_now', ...ROME, category: 'cafe' })).status, 402);
});

await step('Geçerli imzalı ödül +1 hak verir; aynı işlem iki kez sayılmaz', async () => {
  const tx = `same-tx-${Date.now()}`;
  const first = await reward({ userId, tx });
  assert.equal(first.status, 200);
  assert.equal(first.data.result, 'granted');
  assert.equal((await reward({ userId, tx })).data.result, 'duplicate');
  assert.equal((await places({ action: 'open_now', ...ROME, category: 'cafe' })).status, 200);
  assert.equal((await places({ action: 'open_now', ...ROME, category: 'cafe' })).status, 402, 'tek ödül tek hak');
});

await step('Günde en fazla 3 ödül; izin verilmeyen özellik reddedilir', async () => {
  assert.equal((await reward({ userId })).data.result, 'granted');
  assert.equal((await reward({ userId })).data.result, 'granted');
  assert.equal((await reward({ userId })).data.result, 'daily_limit');
  assert.equal((await reward({ userId, feature: 'itinerary_generation' })).data.ignored, true);
});

console.log(`\n${steps.length} adım geçti.`);
