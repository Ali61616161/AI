#!/usr/bin/env node
// Uçtan uca test: çeviri merkezi (metin, konuşma, kamera) ve ücretsiz plan kotaları.
// Yerel ortamda Google Translation ve Gemini yerine test ikizleri çalışır.
//
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/translate.e2e.mjs
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
const translate = (body) => call('/functions/v1/translate', body);

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}

// 1x1 JPEG (geçerli bir görsel olması yeterli; içeriği test ikizi okumaz).
const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAP/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AKAA/9k=';

await step('Giriş yapılmadan reddedilir', async () => {
  assert.equal((await translate({ mode: 'text', text: 'Merhaba', target: 'it' })).status, 401);
});

await step('Giriş', async () => {
  const r = await call('/auth/v1/verify', { email: `tr-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  token = r.data.access_token;
});

await step('Metin çevirisi: kaynak dil otomatik algılanır, Google\'a şemaya uygun istek gider', async () => {
  const r = await translate({ mode: 'text', text: 'Merhaba, hesap lütfen', target: 'it' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.text, '[it] Merhaba, hesap lütfen');
  assert.equal(r.data.detected_source, 'tr');
  assert.equal(r.data.quota.remaining, 19);
  const calls = await (await fetch(`${FAKE_GOOGLE}/calls`)).json();
  const last = calls.filter((c) => c.api === 'translate').at(-1);
  assert.deepEqual(last.errors, []);
  assert.deepEqual(last.body, { q: ['Merhaba, hesap lütfen'], target: 'it', format: 'text' });
});

await step('Geçersiz dil ve boş metin reddedilir (kota harcanmaz)', async () => {
  assert.equal((await translate({ mode: 'text', text: 'x', target: 'Italian' })).status, 400);
  assert.equal((await translate({ mode: 'text', text: '  ', target: 'it' })).status, 400);
  assert.equal((await translate({ mode: 'text', text: 'x'.repeat(2001), target: 'it' })).status, 400);
});

await step('Ücretsiz planda günde 20 metin çevirisi; 21. reddedilir', async () => {
  for (let i = 0; i < 19; i++) assert.equal((await translate({ mode: 'text', text: `t${i}`, target: 'en', source: 'tr' })).status, 200);
  const r = await translate({ mode: 'text', text: 'son', target: 'en' });
  assert.equal(r.status, 402);
  assert.equal(r.data.error.code, 'quota_exceeded');
});

await step('Konuşma çevirisi saniyeyle sayılır: günde 300 saniye (bir seferde en fazla 60)', async () => {
  let r;
  for (let i = 0; i < 4; i++) {
    r = await translate({ mode: 'voice', text: 'Dov\'è la stazione?', source: 'it', target: 'tr', seconds: 70 });
    assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  assert.equal(r.data.text, '[tr] Dov\'è la stazione?');
  assert.equal(r.data.quota.remaining, 60, '4 x 60 sn (70 sn 60\'a sınırlanır) sonra 60 sn kalmalı');
  assert.equal((await translate({ mode: 'voice', text: 'x', source: 'tr', target: 'it', seconds: 45 })).status, 200);
  const over = await translate({ mode: 'voice', text: 'x', source: 'tr', target: 'it', seconds: 20 });
  assert.equal(over.status, 402);
  assert.equal(over.data.quota.remaining, 15);
  const status = await call('/rest/v1/rpc/quota_status', { p_feature: 'voice_translation' });
  assert.equal(status.data[0].used_today, 285);
});

await step('Kamera: menü fotoğrafı çevrilir, bölüm, fiyat ve alerjen notlarıyla', async () => {
  const r = await translate({ mode: 'image', image: JPEG, mime_type: 'image/jpeg', target: 'tr' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.kind, 'menu');
  assert.equal(r.data.source_language, 'it');
  assert.match(r.data.summary, /Turkish/);
  assert.deepEqual(r.data.items.map((i) => [i.section, i.price]), [['Primi', '€12'], ['Dolci', '€7']]);
  assert.equal((await translate({ mode: 'image', image: JPEG, mime_type: 'application/pdf', target: 'tr' })).status, 400);
});

await step('Ücretsiz planda günde 3 kamera çevirisi; 4. reddedilir', async () => {
  for (let i = 0; i < 2; i++) assert.equal((await translate({ mode: 'image', image: JPEG, mime_type: 'image/jpeg', target: 'tr' })).status, 200);
  assert.equal((await translate({ mode: 'image', image: JPEG, mime_type: 'image/jpeg', target: 'tr' })).status, 402);
});

console.log(`\n${steps.length} adım geçti.`);
