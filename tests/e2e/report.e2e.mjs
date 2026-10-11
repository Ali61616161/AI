#!/usr/bin/env node
// Uçtan uca test: biten seyahatin raporu, mekan puanları ve tercihlerin bir
// sonraki rotaya geri beslenmesi.
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/report.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
const FAKE_GEMINI = process.env.FAKE_GEMINI_URL ?? 'http://127.0.0.1:54340';
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

async function createTrip(title, start, end) {
  const user = (await call('/auth/v1/user', undefined, 'GET')).data;
  const doc = await call('/rest/v1/documents', { storage_path: `${user.id}/${title}.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  const t = await call('/rest/v1/rpc/create_trip_from_documents', {
    p_trip: { title, start_date: start, end_date: end, budget_tier: 'mid', companion_type: 'couple', interests: ['art'] },
    p_destinations: [{ city: 'Rome', country_code: 'IT', arrive_on: start, depart_on: end }],
    p_reservations: [{ document_id: doc.data[0].id, type: 'hotel', title: `${title} Hotel`, starts_at: `${start}T13:00:00Z`, ends_at: `${end}T09:00:00Z`, start_timezone: 'Europe/Rome', end_timezone: 'Europe/Rome' }],
    p_document_ids: [doc.data[0].id],
  });
  assert.equal(t.status, 200, JSON.stringify(t.data));
  return t.data;
}

let tripId;
let items;

await step('Giriş ve geçen hafta biten seyahat, rotası ile', async () => {
  token = (await call('/auth/v1/verify', { email: `report-${Date.now()}@yola.local`, token: '123456', type: 'email' })).data.access_token;
  tripId = await createTrip('Past Rome', isoDate(-9), isoDate(-7));
  assert.equal((await call('/functions/v1/generate-itinerary', { trip_id: tripId })).status, 200);
  const { data } = await call(`/rest/v1/plan_items?trip_id=eq.${tripId}&is_locked=eq.false&place_name=not.is.null&select=id,title,place_name,day_plans!inner(plan_versions!inner(is_active))&day_plans.plan_versions.is_active=eq.true&order=starts_at`, undefined, 'GET');
  items = data;
  assert.ok(items.length >= 2);
});

await step('Başlamamış seyahatin raporu oluşturulamaz', async () => {
  const future = await createTrip('Future', isoDate(30), isoDate(32));
  assert.equal((await call('/functions/v1/trip-report', { trip_id: future })).status, 400);
});

await step('Mekan puanı ve atlama: plan durumları güncellenir', async () => {
  const r = await call('/rest/v1/place_ratings', { trip_id: tripId, plan_item_id: items[0].id, place_name: items[0].place_name, rating: 5 }, 'POST', { prefer: 'resolution=merge-duplicates' });
  assert.equal(r.status, 201, JSON.stringify(r.data));
  assert.equal((await call(`/rest/v1/plan_items?id=eq.${items[0].id}`, { status: 'visited' }, 'PATCH')).status, 204);
  assert.equal((await call(`/rest/v1/plan_items?id=eq.${items[1].id}`, { status: 'skipped' }, 'PATCH')).status, 204);
  assert.equal((await call('/rest/v1/rpc/add_expense', { p_trip_id: tripId, p_amount: 42, p_currency: 'EUR', p_amount_in_budget_currency: 42, p_category: 'food', p_description: 'x', p_paid_by_name: 'Ben' })).status, 200);
});

await step('Rapor: istatistik, AI özeti (izinli etiketler), seyahat tamamlandı', async () => {
  const r = await call('/functions/v1/trip-report', { trip_id: tripId, overall_rating: 5, route_rating: 4, feedback: 'Harikaydı' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.ai_failed, false);
  assert.equal(r.data.stats.visited, 1);
  assert.equal(r.data.stats.skipped, 1);
  assert.equal(r.data.stats.spent, 42);
  assert.equal(r.data.stats.averageRating, 5);
  assert.deepEqual(r.data.insights.liked, ['history', 'museums'], 'izinli olmayan etiket (casino) atılmalı');
  assert.match(r.data.insights.summary, new RegExp(`${items[0].place_name}: 5/5`));
  const { data: report } = await call(`/rest/v1/trip_reports?trip_id=eq.${tripId}&select=overall_rating,route_rating,feedback,ai_insights`, undefined, 'GET');
  assert.equal(report[0].overall_rating, 5);
  assert.equal(report[0].ai_insights.disliked[0], 'nightlife');
  const { data: trip } = await call(`/rest/v1/trips?id=eq.${tripId}&select=status,completed_at`, undefined, 'GET');
  assert.equal(trip[0].status, 'completed');
  assert.ok(trip[0].completed_at);
});

await step('Sonraki seyahatin rotası geçmiş tercihleri kullanır', async () => {
  const next = await createTrip('Next Rome', isoDate(10), isoDate(11));
  assert.equal((await call('/functions/v1/generate-itinerary', { trip_id: next })).status, 200);
  const prompts = await (await fetch(`${FAKE_GEMINI}/prompts`)).json();
  const last = prompts.filter((p) => p.includes('Days to plan')).at(-1);
  assert.match(last, /they enjoyed history, museums/);
  assert.match(last, /less keen on nightlife/);
});

console.log(`\n${steps.length} adım geçti.`);
