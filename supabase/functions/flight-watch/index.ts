// Zamanlayıcı (pg_cron, 15 dakikada bir) çağırır: kalkışına 24 saatten az kalan uçuşları kontrol eder ve yeni
// gecikme/iptal olduğunda seyahat üyelerinin cihazlarına anlık bildirim (Expo Push) gönderir.
// JWT doğrulaması kapalıdır (supabase/config.toml); çağıran x-cron-secret başlığıyla doğrulanır
// (değer veritabanında internal_secrets.cron).
import { adminClient } from '../_shared/admin.ts';
import { cachedFlight } from '../_shared/flight-provider.ts';
import { alertKey, alertLevel, alertMessage, cacheTtlMin, localDate, localTime, normalizeFlightNumber } from '../_shared/flight-status.ts';
import { error, json } from '../_shared/http.ts';

const MAX_RESERVATIONS = 200;
const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Message = { to: string; title: string; body: string; data: { url: string }; sound: 'default'; priority: 'high' };

async function sendPush(messages: Message[]): Promise<string[]> {
  const dead: string[] = [];
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(batch),
        signal: AbortSignal.timeout(10_000),
      });
      const tickets = ((await res.json()) as { data?: { status: string; details?: { error?: string } }[] }).data ?? [];
      tickets.forEach((t, k) => {
        if (t.status === 'error' && t.details?.error === 'DeviceNotRegistered') dead.push(batch[k].to);
      });
    } catch (e) {
      console.error('flight-watch: push failed', String(e).slice(0, 120));
    }
  }
  return dead;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  const admin = adminClient();
  const key = Deno.env.get('AERODATABOX_KEY');
  if (!admin) return error('not_configured', 503);

  const { data: secret } = await admin.from('internal_secrets').select('value').eq('key', 'cron').maybeSingle();
  const given = req.headers.get('x-cron-secret') ?? '';
  if (!secret?.value || !safeEqual(given, secret.value)) return error('unauthorized', 401);
  if (!key) return json({ ok: true, configured: false });

  const now = Date.now();
  const { data: reservations, error: dbErr } = await admin
    .from('reservations')
    .select('id, trip_id, starts_at, ends_at, start_timezone, origin_code, details')
    .eq('type', 'flight')
    .eq('is_cancelled', false)
    .gte('starts_at', new Date(now - 12 * 3600_000).toISOString())
    .lte('starts_at', new Date(now + 24 * 3600_000).toISOString())
    .order('starts_at')
    .limit(MAX_RESERVATIONS);
  if (dbErr) {
    console.error('flight-watch: reservations', dbErr.message);
    return error('bad_request', 500, 'db_error');
  }

  let checked = 0;
  let sent = 0;
  const dead: string[] = [];
  for (const r of reservations ?? []) {
    const number = normalizeFlightNumber((r.details as Record<string, unknown> | null)?.flight_number);
    if (!number) continue;
    const toDeparture = (Date.parse(r.starts_at) - now) / 60_000;
    const sinceArrival = r.ends_at ? (now - Date.parse(r.ends_at)) / 60_000 : -Infinity;
    const ttl = cacheTtlMin(toDeparture, sinceArrival);
    if (ttl === null) continue;

    const got = await cachedFlight(admin, key, { number, date: localDate(r.starts_at, r.start_timezone), origin: (r.origin_code ?? '').toUpperCase().slice(0, 4), ttlMin: ttl, now });
    checked++;
    if (!got) continue;
    const level = alertLevel(got.status);
    if (level === 'none') continue;
    const sig = alertKey(level, got.status);
    const { data: already } = await admin.from('flight_alerts_sent').select('reservation_id').eq('reservation_id', r.id).eq('alert_key', sig).maybeSingle();
    if (already) continue;

    // Seyahatin tüm üyeleri (sahip ve davetliler) bilgilendirilir.
    const { data: members } = await admin.from('trip_members').select('user_id').eq('trip_id', r.trip_id);
    const ids = (members ?? []).map((m) => m.user_id as string);
    if (ids.length === 0) continue;
    const [{ data: tokens }, { data: profiles }] = await Promise.all([
      admin.from('push_tokens').select('token, user_id').in('user_id', ids),
      admin.from('profiles').select('id, preferred_language').in('id', ids),
    ]);
    const lang = new Map((profiles ?? []).map((p) => [p.id as string, p.preferred_language as string]));
    const revised = got.status.departure.revised_utc;
    const messages: Message[] = (tokens ?? []).map((t) => {
      const language = lang.get(t.user_id as string) ?? 'en';
      const { title, body } = alertMessage(language, level, { number, time: revised ? localTime(revised, r.start_timezone, language) : '', min: got.status.departure.delay_min });
      return { to: t.token as string, title, body, data: { url: `/trip/${r.trip_id}` }, sound: 'default', priority: 'high' };
    });
    // Önce işaretlenir (gönderim yarıda kalsa bile aynı bildirim tekrar tekrar gitmez).
    await admin.from('flight_alerts_sent').upsert({ reservation_id: r.id, alert_key: sig });
    if (messages.length > 0) {
      dead.push(...(await sendPush(messages)));
      sent += messages.length;
    }
  }
  if (dead.length > 0) await admin.from('push_tokens').delete().in('token', dead);
  return json({ ok: true, configured: true, checked, sent });
});
