// Seyahatteki yaklaşan uçuşların canlı durumu (gecikme, iptal, kapı, terminal, bagaj bandı).
//
//   POST { "trip_id" } → { configured: boolean, flights: [{ reservation_id, flight_number, checked_at, status, alert }] }
//
// Yalnızca kullanıcının erişebildiği seyahatin uçuşları sorgulanır (keyfi uçuş sorgulanamaz). Sonuçlar paylaşımlı
// önbellekte tutulur; kalkışa 24 saatten fazla olan uçuşlar sorgulanmaz.
// Gerekli sunucu sırrı: AERODATABOX_KEY (RapidAPI anahtarı). Yoksa configured:false döner, hata vermez.
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { cachedFlight, fetchFlightInfo, probeProvider } from '../_shared/flight-provider.ts';
import { alertLevel, cacheTtlMin, type FlightInfo, type FlightStatus, localDate, normalizeFlightNumber } from '../_shared/flight-status.ts';
import { corsHeaders, dbError, error, json } from '../_shared/http.ts';

const MAX_FLIGHTS = 6;
let probe: { at: number; status: number; message: string } | null = null;

/** Uçuş araması kullanıcı başına saatte en çok bu kadar (ücretsiz kotayı korur); sunucu belleğinde tutulur. */
const LOOKUPS_PER_HOUR = 12;
const lookups = new Map<string, number[]>();
function lookupAllowed(userId: string, now: number): boolean {
  const recent = (lookups.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= LOOKUPS_PER_HOUR) return false;
  recent.push(now);
  lookups.set(userId, recent);
  if (lookups.size > 5000) lookups.clear();
  return true;
}
const LOOKUP_TTL_MS = 12 * 3600_000;

type Reservation = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  start_timezone: string | null;
  origin_code: string | null;
  details: Record<string, unknown> | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const auth = await userClient(req);
  if (!auth) return error('unauthorized', 401);
  const { supabase, user } = auth;

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  const key = Deno.env.get('AERODATABOX_KEY');
  const admin = adminClient();

  // Kurulum kontrolü (canlı kontrol iş akışı): anahtar tanımlı mı ve servis kabul ediyor mu. Sonuç 10 dk önbelleklenir,
  // anahtarın kendisi hiçbir zaman dönmez.
  if (body?.check === true) {
    if (!key) return json({ configured: false });
    if (!probe || Date.now() - probe.at > 600_000) probe = { at: Date.now(), ...(await probeProvider(key)) };
    return json({ configured: true, provider_status: probe.status, provider_message: probe.message, provider_ok: probe.status === 200 || probe.status === 404 });
  }
  // Uçuş arama: numara + tarihle havalimanları ve saatler (seyahat oluştururken otomatik doldurma).
  if (body?.lookup === true) {
    const number = normalizeFlightNumber(body.number);
    const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : null;
    if (!number || !date) return error('bad_request', 400, 'number and date are required');
    const dayMs = Date.parse(`${date}T12:00:00Z`);
    if (!Number.isFinite(dayMs) || dayMs < Date.now() - 2 * 86_400_000 || dayMs > Date.now() + 330 * 86_400_000) return json({ configured: Boolean(key), found: false, flight: null });
    if (!key || !admin) return json({ configured: false, found: false, flight: null });
    const now = Date.now();
    const { data: cached } = await admin.from('flight_lookup_cache').select('data, fetched_at').eq('flight_number', number).eq('flight_date', date).maybeSingle();
    if (cached && now - Date.parse(cached.fetched_at) < LOOKUP_TTL_MS) return json({ configured: true, found: Boolean(cached.data), flight: (cached.data as FlightInfo | null) ?? null });
    if (!lookupAllowed(user.id, now)) return error('quota_exceeded', 429);
    const info = await fetchFlightInfo(key, number, date);
    if (info === 'failed') return error('upstream_failed', 502);
    await admin.from('flight_lookup_cache').upsert({ flight_number: number, flight_date: date, data: info, fetched_at: new Date().toISOString() });
    return json({ configured: true, found: info !== null, flight: info });
  }
  if (typeof body?.trip_id !== 'string') return error('bad_request', 400, 'trip_id is required');

  if (!key || !admin) return json({ configured: false, flights: [] });

  // RLS: yalnızca üyesi olunan seyahatin rezervasyonları gelir.
  const now = Date.now();
  const { data, error: dbErr } = await supabase
    .from('reservations')
    .select('id, starts_at, ends_at, start_timezone, origin_code, details')
    .eq('trip_id', body.trip_id)
    .eq('type', 'flight')
    .eq('is_cancelled', false)
    .gte('starts_at', new Date(now - 12 * 3600_000).toISOString())
    .lte('starts_at', new Date(now + 24 * 3600_000).toISOString())
    .order('starts_at')
    .limit(MAX_FLIGHTS);
  if (dbErr) return dbError('flight-status: reservations', dbErr);

  const out: { reservation_id: string; flight_number: string; checked_at: string; status: FlightStatus; alert: string }[] = [];
  for (const r of (data ?? []) as Reservation[]) {
    const number = normalizeFlightNumber(r.details?.flight_number);
    if (!number) continue;
    const minutesToDeparture = (Date.parse(r.starts_at) - now) / 60_000;
    const sinceArrival = r.ends_at ? (now - Date.parse(r.ends_at)) / 60_000 : -Infinity;
    const ttl = cacheTtlMin(minutesToDeparture, sinceArrival);
    if (ttl === null) continue;

    const date = localDate(r.starts_at, r.start_timezone);
    const origin = (r.origin_code ?? '').toUpperCase().slice(0, 4);
    const got = await cachedFlight(admin, key, { number, date, origin, ttlMin: ttl, now });
    const status = got?.status ?? null;
    const checkedAt = got?.checkedAt ?? null;
    if (status && checkedAt) out.push({ reservation_id: r.id, flight_number: number, checked_at: checkedAt, status, alert: alertLevel(status) });
  }
  return json({ configured: true, flights: out });
});
