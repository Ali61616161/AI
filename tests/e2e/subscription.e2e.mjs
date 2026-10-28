#!/usr/bin/env node
// Uçtan uca test: abonelik. Satın alma RevenueCat test ikizinde "yapılır"; sunucu
// durumu RevenueCat REST'ten doğrular, webhook olaylarını işler ve kotalar planı izler.
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/subscription.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
const FAKE = process.env.FAKE_GOOGLE_URL ?? 'http://127.0.0.1:54341';
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
const webhook = (event, auth = 'test-webhook-auth') =>
  fetch(`${BASE}/functions/v1/revenuecat-webhook`, { method: 'POST', headers: { authorization: auth, 'content-type': 'application/json' }, body: JSON.stringify({ event }) });
const setRc = (userId, subscriber) => fetch(`${FAKE}/__rc/subscribers/${userId}`, { method: 'POST', body: JSON.stringify(subscriber) });
const plan = async (tripId) => (await call('/rest/v1/rpc/current_plan', tripId ? { p_trip_id: tripId } : {})).data;

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}
const isoDate = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
let user;
let tripId;
const TX = `GPA.TP-${Date.now()}`;

await step('Giriş ve seyahat; plan ücretsiz', async () => {
  token = (await call('/auth/v1/verify', { email: `sub-${Date.now()}@yola.local`, token: '123456', type: 'email' })).data.access_token;
  user = (await call('/auth/v1/user', undefined, 'GET')).data;
  const doc = await call('/rest/v1/documents', { storage_path: `${user.id}/s.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  tripId = (await call('/rest/v1/rpc/create_trip_from_documents', {
    p_trip: { title: 'Sub', start_date: isoDate(3), end_date: isoDate(9), budget_tier: 'mid', companion_type: 'solo', interests: [] },
    p_destinations: [{ city: 'Rome', country_code: 'IT', arrive_on: isoDate(3), depart_on: isoDate(9) }],
    p_reservations: [{ document_id: doc.data[0].id, type: 'hotel', title: 'H', starts_at: `${isoDate(3)}T13:00:00Z`, ends_at: `${isoDate(9)}T09:00:00Z`, start_timezone: 'Europe/Rome', end_timezone: 'Europe/Rome' }],
    p_document_ids: [doc.data[0].id],
  })).data;
  assert.equal(await plan(), 'free');
});

await step('Kullanıcı aboneliğini kendisi yazamaz (RLS)', async () => {
  const r = await call('/rest/v1/subscriptions', { user_id: user.id, plan: 'pro_yearly', status: 'active', store: 'app_store', product_id: 'x', original_transaction_id: 'fake' });
  assert.ok(r.status === 401 || r.status === 403, String(r.status));
  assert.equal(await plan(), 'free');
});

await step('Satın alma olmadan senkronizasyon planı değiştirmez; Trip Pass olmadan claim 404', async () => {
  assert.equal((await call('/functions/v1/subscription', { action: 'sync' })).data.plan, 'free');
  assert.equal((await call('/functions/v1/subscription', { action: 'claim_trip_pass', trip_id: tripId })).status, 404);
});

await step('Trip Pass: satın alma seyahate bağlanır, sadece o seyahat için geçerli; tekrar bağlanamaz', async () => {
  await setRc(user.id, { non_subscriptions: { yola_trip_pass: [{ id: 'rc_tp_1', store_transaction_id: TX, purchase_date: new Date().toISOString(), store: 'play_store' }] } });
  const r = await call('/functions/v1/subscription', { action: 'claim_trip_pass', trip_id: tripId });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.plan, 'trip_pass');
  assert.equal(await plan(tripId), 'trip_pass');
  assert.equal(await plan(), 'free', 'Trip Pass başka seyahatleri kapsamaz');
  assert.equal((await call('/functions/v1/subscription', { action: 'claim_trip_pass', trip_id: tripId })).status, 404, 'aynı satın alma ikinci kez bağlanamaz');
  // Trip Pass ile bu seyahatte AI rota tüm günleri kapsar.
  const gen = await call('/functions/v1/generate-itinerary', { trip_id: tripId });
  assert.equal(gen.data.truncated, false);
  assert.equal(gen.data.days_planned, 7);
});

await step('Webhook: yanlış sır reddedilir; Pro satın alma, iptal (süre sonuna kadar erişim), süre sonu', async () => {
  const base = { app_user_id: user.id, product_id: 'yola_pro_yearly:annual', store: 'PLAY_STORE', purchased_at_ms: Date.now(), expiration_at_ms: Date.now() + 365 * 86_400_000 };
  assert.equal((await webhook({ ...base, type: 'INITIAL_PURCHASE' }, 'wrong')).status, 401);
  assert.equal((await webhook({ ...base, type: 'INITIAL_PURCHASE' })).status, 200);
  assert.equal(await plan(), 'pro_yearly');
  assert.equal((await webhook({ ...base, type: 'CANCELLATION', cancel_reason: 'UNSUBSCRIBE' })).status, 200);
  assert.equal(await plan(), 'pro_yearly', 'otomatik yenileme kapatılınca dönem sonuna kadar Pro');
  assert.equal((await webhook({ ...base, type: 'EXPIRATION', expiration_at_ms: Date.now() - 1000 })).status, 200);
  assert.equal(await plan(), 'free');
  const ignored = await (await webhook({ type: 'TEST', app_user_id: user.id })).json();
  assert.equal(ignored.ignored, true);
});

await step('Senkronizasyon: RevenueCat\'teki aktif aylık abonelik Pro yapar; kotalar sınırsızlaşır', async () => {
  await setRc(user.id, { subscriptions: { yola_pro_monthly: { expires_date: new Date(Date.now() + 30 * 86_400_000).toISOString(), purchase_date: new Date().toISOString(), store: 'app_store' } } });
  assert.equal((await call('/functions/v1/subscription', { action: 'sync' })).data.plan, 'pro_monthly');
  const q = await call('/rest/v1/rpc/quota_status', { p_feature: 'text_translation' });
  assert.equal(q.data[0].per_day, null);
});

await step('Trip Pass iadesi webhook ile seyahatten kaldırılır', async () => {
  const r = await webhook({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', app_user_id: user.id, product_id: 'yola_trip_pass', transaction_id: TX, store: 'PLAY_STORE' });
  assert.equal(r.status, 200);
  const { data } = await call(`/rest/v1/subscriptions?plan=eq.trip_pass&select=status`, undefined, 'GET');
  assert.equal(data[0].status, 'refunded');
});

await step('Bağlanmadan iade edilen Trip Pass sonradan seyahate bağlanamaz', async () => {
  const TX2 = `GPA.TP-REFUNDED-${Date.now()}`;
  const old = { id: 'rc_tp_1', store_transaction_id: TX, purchase_date: new Date(Date.now() - 86_400_000).toISOString(), store: 'play_store' };
  await setRc(user.id, { non_subscriptions: { yola_trip_pass: [old, { id: 'rc_tp_2', store_transaction_id: TX2, purchase_date: new Date().toISOString(), store: 'play_store' }] } });
  const refund = await webhook({ type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', app_user_id: user.id, product_id: 'yola_trip_pass', transaction_id: TX2, store: 'PLAY_STORE' });
  assert.equal(refund.status, 200);
  const doc2 = await call('/rest/v1/documents', { storage_path: `${user.id}/s2.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  const created = await call('/rest/v1/rpc/create_trip_from_documents', {
    p_trip: { title: 'Sub2', start_date: isoDate(20), end_date: isoDate(22), budget_tier: 'mid', companion_type: 'solo', interests: [] },
    p_destinations: [{ city: 'Paris', country_code: 'FR', arrive_on: isoDate(20), depart_on: isoDate(22) }],
    p_reservations: [{ document_id: doc2.data[0].id, type: 'hotel', title: 'H2', starts_at: `${isoDate(20)}T13:00:00Z`, ends_at: `${isoDate(22)}T09:00:00Z`, start_timezone: 'Europe/Paris', end_timezone: 'Europe/Paris' }],
    p_document_ids: [doc2.data[0].id],
  });
  assert.equal(created.status, 200, JSON.stringify(created.data));
  const other = created.data;
  const claim = await call('/functions/v1/subscription', { action: 'claim_trip_pass', trip_id: other });
  assert.equal(claim.status, 404, 'iade edilmiş satın alma bağlanmamalı');
});

console.log(`\n${steps.length} adım geçti.`);
