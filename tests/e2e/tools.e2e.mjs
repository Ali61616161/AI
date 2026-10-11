#!/usr/bin/env node
// Uçtan uca test: vize bilgisi (travel-info), harcama bölüşme ve bavul listesi.
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/tools.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
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
const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}
const isoDate = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
let tripId;

await step('Giriş ve seyahat', async () => {
  token = (await call('/auth/v1/verify', { email: `tools-${Date.now()}@yola.local`, token: '123456', type: 'email' })).data.access_token;
  const user = (await call('/auth/v1/user', undefined, 'GET')).data;
  const doc = await call('/rest/v1/documents', { storage_path: `${user.id}/t.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  const t = await call('/rest/v1/rpc/create_trip_from_documents', {
    p_trip: { title: 'Tools E2E', start_date: isoDate(5), end_date: isoDate(8), budget_tier: 'mid', companion_type: 'friends', interests: [] },
    p_destinations: [{ city: 'Rome', country_code: 'IT', arrive_on: isoDate(5), depart_on: isoDate(8) }],
    p_reservations: [{ document_id: doc.data[0].id, type: 'flight', title: 'IST → FCO', starts_at: `${isoDate(5)}T07:00:00Z`, start_timezone: 'Europe/Istanbul', end_timezone: 'Europe/Rome' }],
    p_document_ids: [doc.data[0].id],
  });
  assert.equal(t.status, 200, JSON.stringify(t.data));
  tripId = t.data;
});

await step('Vize bilgisi: yapılandırılmış cevap, güvensiz bağlantı atılır', async () => {
  const r = await call('/functions/v1/travel-info', { passport: 'tr', destination: 'IT' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.requirement, 'visa_required');
  assert.equal(r.data.maxStayDays, 90);
  assert.equal(r.data.documents.length, 2);
  assert.equal(r.data.officialUrl, null, 'javascript: bağlantısı atılmalı');
  assert.equal(r.data.passport, 'TR');
  assert.equal((await call('/functions/v1/travel-info', { passport: 'TUR', destination: 'IT' })).status, 400);
});

await step('Ücretsiz planda günde 5 vize sorgusu; 6. reddedilir', async () => {
  for (let i = 0; i < 4; i++) assert.equal((await call('/functions/v1/travel-info', { passport: 'TR', destination: 'FR' })).status, 200);
  assert.equal((await call('/functions/v1/travel-info', { passport: 'TR', destination: 'FR' })).status, 402);
});

await step('Harcama bölüşme: payların toplamı tutara eşit', async () => {
  const r = await call('/rest/v1/rpc/add_expense', {
    p_trip_id: tripId, p_amount: 90, p_currency: 'EUR', p_amount_in_budget_currency: 90, p_category: 'food', p_description: 'Pizza', p_paid_by_name: 'Ben', p_participants: ['Ben', 'Ece', 'Mert'],
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  const { data } = await call(`/rest/v1/expenses?trip_id=eq.${tripId}&select=amount,paid_by_name,expense_shares(participant_name,share_amount)`, undefined, 'GET');
  assert.equal(data[0].paid_by_name, 'Ben');
  assert.deepEqual(data[0].expense_shares.map((s) => Number(s.share_amount)), [30, 30, 30]);
});

await step('Bavul listesi: eklenir, işaretlenir, sadece seyahat üyeleri görür', async () => {
  const add = await call('/rest/v1/packing_items', [{ trip_id: tripId, label: 'Pasaport', category: 'documents', source: 'ai', position: 0 }], 'POST', { prefer: 'return=representation' });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  const id = add.data[0].id;
  assert.equal((await call(`/rest/v1/packing_items?id=eq.${id}`, { is_packed: true }, 'PATCH')).status, 204);
  token = (await call('/auth/v1/verify', { email: `tools-other-${Date.now()}@yola.local`, token: '123456', type: 'email' })).data.access_token;
  const other = await call(`/rest/v1/packing_items?trip_id=eq.${tripId}`, undefined, 'GET');
  assert.deepEqual(other.data, []);
});

console.log(`\n${steps.length} adım geçti.`);
