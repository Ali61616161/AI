#!/usr/bin/env node
// Uçtan uca test: sosyal mod. İki kullanıcı görünür olur, birbirini görür, halka açık
// bir yerde buluşma daveti, kabul, mesajlaşma; engelleme her şeyi kapatır.
// Kullanım: SUPABASE_URL=http://localhost:54321 ANON_KEY=... node tests/e2e/social.e2e.mjs
import assert from 'node:assert/strict';

const BASE = process.env.SUPABASE_URL ?? 'http://localhost:54321';
const ANON = process.env.ANON_KEY;
assert.ok(ANON, 'ANON_KEY gerekli');

function client(token) {
  return async (path, body, method = 'POST', extra = {}) => {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { apikey: ANON, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...extra },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, data: text ? JSON.parse(text) : null };
  };
}
async function signIn(label) {
  const r = await client(ANON)('/auth/v1/verify', { email: `${label}-${Date.now()}@yola.local`, token: '123456', type: 'email' });
  const call = client(r.data.access_token);
  const user = (await call('/auth/v1/user', undefined, 'GET')).data;
  return { call, id: user.id };
}
async function goVisible(u, { name, year, lng, lat, gender = 'female' }) {
  assert.equal((await u.call(`/rest/v1/profiles?id=eq.${u.id}`, { display_name: name, birth_year: year, gender }, 'PATCH')).status, 204);
  await u.call('/rest/v1/consents', [{ consent: 'social_matching', granted: true, version: 't' }, { consent: 'location', granted: true, version: 't' }]);
  return u.call('/rest/v1/social_profiles', { user_id: u.id, is_visible: true, approx_location: `SRID=4326;POINT(${lng} ${lat})`, looking_for: ['coffee'] }, 'POST', { prefer: 'resolution=merge-duplicates' });
}

const steps = [];
async function step(name, fn) {
  await fn();
  steps.push(name);
  console.log(`✓ ${name}`);
}
let ece;
let mert;
let inviteId;

await step('18 yaş altı görünür olamaz; rıza olmadan görünür olunamaz', async () => {
  const kid = await signIn('kid');
  const r = await goVisible(kid, { name: 'Kid', year: new Date().getFullYear() - 15, lng: 12.48, lat: 41.9 });
  assert.notEqual(r.status, 201);
  assert.match(JSON.stringify(r.data), /age_required/);
  const noConsent = await signIn('noconsent');
  await noConsent.call(`/rest/v1/profiles?id=eq.${noConsent.id}`, { display_name: 'X', birth_year: 1990 }, 'PATCH');
  const r2 = await noConsent.call('/rest/v1/social_profiles', { user_id: noConsent.id, is_visible: true, approx_location: 'SRID=4326;POINT(12.48 41.9)' });
  assert.notEqual(r2.status, 201, 'rıza vermeden görünür olunmamalı');
});

await step('İki gezgin görünür olur ve birbirini yaklaşık mesafeyle görür', async () => {
  ece = await signIn('ece');
  mert = await signIn('mert');
  assert.equal((await goVisible(ece, { name: 'Ece', year: 1996, lng: 12.4823, lat: 41.8955 })).status, 201);
  assert.equal((await goVisible(mert, { name: 'Mert', year: 1994, lng: 12.4901, lat: 41.9012, gender: 'male' })).status, 201);
  const list = (await ece.call('/rest/v1/rpc/nearby_travelers', { p_radius_km: 10 })).data;
  const m = list.find((x) => x.user_id === mert.id);
  assert.ok(m, 'Mert listede olmalı');
  assert.equal(m.display_name, 'Mert');
  assert.equal(Number(m.distance_km) % 0.5, 0, 'mesafe 0,5 km\'ye yuvarlanmalı');
});

await step('Davet: halka açık yer ve gelecek saat; ücretsiz planda günde 1', async () => {
  const meetAt = new Date(Date.now() + 2 * 3_600_000).toISOString();
  const past = await ece.call('/rest/v1/rpc/send_invite', { p_to_user: mert.id, p_google_place_id: 'p1', p_place_name: 'Caffè Sant’Eustachio', p_place_lng: 12.4755, p_place_lat: 41.8983, p_meet_at: new Date(Date.now() - 60_000).toISOString() });
  assert.notEqual(past.status, 200, 'geçmiş saat reddedilmeli');
  const r = await ece.call('/rest/v1/rpc/send_invite', { p_to_user: mert.id, p_google_place_id: 'p1', p_place_name: 'Caffè Sant’Eustachio', p_place_lng: 12.4755, p_place_lat: 41.8983, p_meet_at: meetAt, p_message: 'Kahve?' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  inviteId = r.data;
  const second = await ece.call('/rest/v1/rpc/send_invite', { p_to_user: mert.id, p_google_place_id: 'p2', p_place_name: 'Museo', p_place_lng: 12.47, p_place_lat: 41.9, p_meet_at: meetAt });
  assert.equal(second.data.hint, 'upgrade', 'ikinci davet kotaya takılmalı');
});

await step('Davet listesi: karşı tarafın adı; kabul edilmeden mesaj yazılamaz', async () => {
  const inv = (await mert.call('/rest/v1/rpc/my_invites', {})).data.find((i) => i.id === inviteId);
  assert.equal(inv.incoming, true);
  assert.equal(inv.other_name, 'Ece');
  assert.equal(inv.message, 'Kahve?');
  const early = await mert.call('/rest/v1/messages', { invite_id: inviteId, body: 'Selam' });
  assert.notEqual(early.status, 201);
});

await step('Kabul ve mesajlaşma; üçüncü kişi mesajları göremez', async () => {
  assert.equal((await mert.call('/rest/v1/rpc/respond_invite', { p_invite_id: inviteId, p_status: 'accepted' })).status, 204);
  assert.equal((await mert.call('/rest/v1/messages', { invite_id: inviteId, body: 'Olur, 2 saate oradayım' })).status, 201);
  assert.equal((await ece.call('/rest/v1/messages', { invite_id: inviteId, body: 'Süper!' })).status, 201);
  const msgs = (await ece.call(`/rest/v1/messages?invite_id=eq.${inviteId}&order=created_at`, undefined, 'GET')).data;
  assert.deepEqual(msgs.map((m) => m.body), ['Olur, 2 saate oradayım', 'Süper!']);
  const stranger = await signIn('stranger');
  assert.deepEqual((await stranger.call(`/rest/v1/messages?invite_id=eq.${inviteId}`, undefined, 'GET')).data, []);
  const last = (await ece.call('/rest/v1/rpc/my_invites', {})).data.find((i) => i.id === inviteId);
  assert.equal(last.last_message, 'Süper!');
});

await step('Şikayet ve engelleme: davet iptal, sohbet ve liste kapanır', async () => {
  assert.equal((await ece.call('/rest/v1/user_reports', { reported_id: mert.id, invite_id: inviteId, reason: 'harassment' })).status, 201);
  assert.equal((await ece.call('/rest/v1/user_blocks', { blocked_id: mert.id })).status, 201);
  assert.ok(!(await ece.call('/rest/v1/rpc/my_invites', {})).data.some((i) => i.id === inviteId));
  assert.ok(!(await mert.call('/rest/v1/rpc/nearby_travelers', { p_radius_km: 10 })).data.some((x) => x.user_id === ece.id), 'engelleyen görünmemeli');
  assert.notEqual((await mert.call('/rest/v1/messages', { invite_id: inviteId, body: 'Neden?' })).status, 201, 'engellendikten sonra mesaj yazılamaz');
});

console.log(`\n${steps.length} adım geçti.`);
