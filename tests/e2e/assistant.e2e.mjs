#!/usr/bin/env node
// Uçtan uca test: seyahat asistanı (soru, ayar değişikliği, herhangi bir günü yeniden planlama, yetki, kota).
// AI cevapları test ikizinden gelir (FAKE_GEMINI=1); AI dışındaki her şey gerçektir.
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/assistant.e2e.mjs
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
const romeDate = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date(Date.now() + offset * 86_400_000));
const ask = (message) => call('/functions/v1/replan', { mode: 'assistant', trip_id: tripId, message, timezone: 'Europe/Rome' });
async function activePlan() {
  const { data } = await get(`plan_versions?trip_id=eq.${tripId}&is_active=eq.true&select=id,version,reason,day_plans(date,plan_items(title,starts_at))`);
  data[0].day_plans.sort((a, b) => a.date.localeCompare(b.date));
  return data[0];
}

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}
let tripId;
const start = romeDate(0);
const end = romeDate(2);

await step('Giriş, seyahat ve plan', async () => {
  token = (await call('/auth/v1/verify', { email: `asst-${Date.now()}@yola.local`, token: '123456', type: 'email' })).data.access_token;
  const user = (await call('/auth/v1/user', undefined, 'GET')).data;
  const doc = await call('/rest/v1/documents', { storage_path: `${user.id}/a.pdf`, mime_type: 'application/pdf', status: 'parsed' }, 'POST', { prefer: 'return=representation' });
  const r = await rpc('create_trip_from_documents', {
    p_trip: { title: 'Asistan Roma', start_date: start, end_date: end, budget_tier: 'low', companion_type: 'solo', interests: ['art'] },
    p_destinations: [{ city: 'Rome', country_code: 'IT', arrive_on: start, depart_on: end }],
    p_reservations: [{ document_id: doc.data[0].id, type: 'hotel', title: 'Asistan Hotel', starts_at: `${start}T13:00:00Z`, ends_at: `${end}T09:00:00Z`, start_timezone: 'Europe/Rome', end_timezone: 'Europe/Rome' }],
    p_document_ids: [doc.data[0].id],
  });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  tripId = r.data;
  assert.equal((await call('/functions/v1/generate-itinerary', { trip_id: tripId })).status, 200);
});

await step('Seyahat olmadan asistan çağrılamaz; mesaj boşsa reddedilir', async () => {
  assert.equal((await call('/functions/v1/replan', { mode: 'assistant', message: 'SORU' })).status, 400);
  assert.equal((await ask('   ')).status, 400);
});

await step('Soru: yalnızca cevap döner, plan ve ayarlar değişmez', async () => {
  const before = await activePlan();
  const r = await ask('SORU uçuşum kaçta?');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.intent, 'question');
  assert.match(r.data.reply, /TEST answer about: Asistan Roma/);
  assert.equal(r.data.plan_version_id, null);
  assert.equal((await activePlan()).id, before.id);
  assert.equal((await get(`trips?id=eq.${tripId}&select=budget_tier`)).data[0].budget_tier, 'low');
});

await step('Ayar değişikliği: bütçe ve ilgi alanları güncellenir', async () => {
  const r = await ask('AYAR bütçeyi yükselt');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.intent, 'update_settings');
  assert.equal(r.data.settings_updated, true);
  const trip = (await get(`trips?id=eq.${tripId}&select=budget_tier,interests`)).data[0];
  assert.equal(trip.budget_tier, 'lux');
  assert.deepEqual(trip.interests, ['food', 'art']);
});

await step('Herhangi bir günü yeniden planlama: seçilen gün değişir, diğer günler aynen kalır, geri alınabilir', async () => {
  const before = await activePlan();
  const lastDay = before.day_plans[before.day_plans.length - 1].date;
  assert.ok(lastDay > start, 'test: gelecekte bir gün olmalı');
  const r = await ask('GUN son günü rahat yap');
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.intent, 'replan_day');
  assert.equal(r.data.date, lastDay);
  assert.ok(r.data.plan_version_id && r.data.previous_version_id === before.id);
  const after = await activePlan();
  assert.equal(after.reason, 'crisis');
  const dayAfter = after.day_plans.find((d) => d.date === lastDay).plan_items.map((i) => i.title);
  assert.ok(dayAfter.includes('TEST indoor gallery'), `yeni gün öğeleri: ${dayAfter.join(', ')}`);
  for (const d of before.day_plans.filter((x) => x.date !== lastDay)) {
    assert.deepEqual(after.day_plans.find((x) => x.date === d.date).plan_items.map((i) => i.title), d.plan_items.map((i) => i.title), `${d.date} değişmemeli`);
  }
  const undo = await rpc('restore_plan_version', { p_version_id: before.id });
  assert.ok([200, 204].includes(undo.status), JSON.stringify(undo.data));
});

await step('Geçmiş gün istenirse plan değişmez; doğrudan geçmiş tarih reddedilir', async () => {
  const before = await activePlan();
  const r = await ask('GECMIS günü değiştir');
  assert.equal(r.status, 200);
  assert.equal(r.data.intent, 'other', 'geçersiz tarih "diğer" olur');
  assert.equal((await activePlan()).id, before.id);
  const direct = await call('/functions/v1/replan', { mode: 'crisis', trip_id: tripId, message: 'x', date: '2020-01-01', timezone: 'Europe/Rome' });
  assert.equal(direct.status, 400);
});

await step('Başka kullanıcı bu seyahat için asistanı kullanamaz', async () => {
  const mine = token;
  token = (await call('/auth/v1/verify', { email: `asst-other-${Date.now()}@yola.local`, token: '123456', type: 'email' })).data.access_token;
  assert.equal((await ask('SORU')).status, 404);
  token = mine;
});

await step('Ücretsiz planda günde 20 asistan mesajı; sonrası reddedilir', async () => {
  let blocked = false;
  for (let i = 0; i < 25 && !blocked; i++) {
    const r = await ask('SORU');
    if (r.status === 402) blocked = true;
    else assert.equal(r.status, 200, JSON.stringify(r.data));
  }
  assert.ok(blocked, 'günlük sınır uygulanmalı');
});

console.log(`\n${steps.length} adım geçti.`);
