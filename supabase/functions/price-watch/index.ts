// Zamanlayıcı (pg_cron, 6 saatte bir) çağırır: aktif fiyat takiplerini kontrol eder, fiyatı kaydeder ve
// hedefe ulaşan / belirgin düşen fiyatlarda cihazlara anlık bildirim (Expo Push) gönderir.
// JWT doğrulaması kapalıdır (supabase/config.toml); çağıran x-cron-secret başlığıyla doğrulanır.
// Sır: TRAVELPAYOUTS_TOKEN (Travelpayouts Data API; ücretsiz). Yoksa kontrol atlanır.
import { adminClient } from '../_shared/admin.ts';
import { error, json } from '../_shared/http.ts';
import { alertMessage, appendPoint, fetchCheapest, shouldAlert, type Cheapest } from '../_shared/price-watch.ts';
import { safeEqual, sendPush, type PushMessage } from '../_shared/push.ts';

const MAX_WATCHES = 300;

Deno.serve(async (req) => {
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  const admin = adminClient();
  if (!admin) return error('not_configured', 503);

  const { data: secret } = await admin.from('internal_secrets').select('value').eq('key', 'cron').maybeSingle();
  if (!secret?.value || !safeEqual(req.headers.get('x-cron-secret') ?? '', secret.value)) return error('unauthorized', 401);
  const token = Deno.env.get('TRAVELPAYOUTS_TOKEN');
  if (!token) return json({ ok: true, configured: false });

  const today = new Date().toISOString().slice(0, 10);
  // Kalkış tarihi geçen takipler kapanır.
  await admin.from('price_watches').update({ active: false }).eq('active', true).lt('depart_on', today);

  const { data: watches, error: dbErr } = await admin
    .from('price_watches')
    .select('id, user_id, origin_code, origin_name, destination_code, destination_name, depart_on, return_on, flexible_month, target_price, currency, last_price, lowest_price, last_alert_price, price_points')
    .eq('active', true)
    .order('last_checked_at', { ascending: true, nullsFirst: true })
    .limit(MAX_WATCHES);
  if (dbErr) {
    console.error('price-watch: watches', dbErr.message);
    return error('bad_request', 500, 'db_error');
  }

  // Aynı rota/tarih/para birimi bir çalıştırmada tek kez sorgulanır.
  const cache = new Map<string, Cheapest | null>();
  let checked = 0;
  let sent = 0;
  const dead: string[] = [];
  for (const w of watches ?? []) {
    const q = { origin: w.origin_code, destination: w.destination_code, departOn: w.depart_on, returnOn: w.return_on, flexibleMonth: w.flexible_month, currency: w.currency };
    const key = JSON.stringify(q);
    let cheapest: Cheapest | null;
    if (cache.has(key)) cheapest = cache.get(key) ?? null;
    else {
      try {
        cheapest = await fetchCheapest(token, q);
      } catch (e) {
        console.error('price-watch: provider', String(e).slice(0, 120));
        continue;
      }
      cache.set(key, cheapest);
    }
    const now = new Date().toISOString();
    if (!cheapest) {
      await admin.from('price_watches').update({ last_checked_at: now }).eq('id', w.id);
      continue;
    }
    checked++;
    const previous = w.last_price === null ? null : Number(w.last_price);
    const target = w.target_price === null ? null : Number(w.target_price);
    const lastAlert = w.last_alert_price === null ? null : Number(w.last_alert_price);
    const alert = shouldAlert({ price: cheapest.price, target, previous, lastAlert });
    await admin
      .from('price_watches')
      .update({
        last_price: cheapest.price,
        lowest_price: w.lowest_price === null ? cheapest.price : Math.min(Number(w.lowest_price), cheapest.price),
        last_airline: cheapest.airline,
        last_checked_at: now,
        price_points: appendPoint(w.price_points, today, cheapest.price),
        ...(alert ? { last_alert_price: cheapest.price } : {}),
      })
      .eq('id', w.id);
    if (!alert) continue;

    const [{ data: tokens }, { data: profile }] = await Promise.all([
      admin.from('push_tokens').select('token').eq('user_id', w.user_id),
      admin.from('profiles').select('preferred_language').eq('id', w.user_id).maybeSingle(),
    ]);
    const { title, body } = alertMessage((profile?.preferred_language as string | undefined) ?? 'en', {
      origin: w.origin_name,
      destination: w.destination_name,
      price: cheapest.price,
      target,
      currency: w.currency,
    });
    const messages: PushMessage[] = (tokens ?? []).map((t) => ({ to: t.token as string, title, body, data: { url: '/price-watch' }, sound: 'default', priority: 'high' }));
    if (messages.length > 0) {
      dead.push(...(await sendPush(messages, 'price-watch')));
      sent += messages.length;
    }
  }
  if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
  return json({ ok: true, configured: true, checked, sent });
});
