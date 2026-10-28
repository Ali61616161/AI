// Seyahatteki yaklaşan uçuşların canlı durumu (gecikme, iptal, kapı, terminal, bagaj bandı).
//
//   POST { "trip_id" } → { configured: boolean, flights: [{ reservation_id, flight_number, checked_at, status, alert }] }
//
// Yalnızca kullanıcının erişebildiği seyahatin uçuşları sorgulanır (keyfi uçuş sorgulanamaz). Sonuçlar paylaşımlı
// önbellekte tutulur; kalkışa 24 saatten fazla olan uçuşlar sorgulanmaz.
// Gerekli sunucu sırrı: AERODATABOX_KEY (RapidAPI anahtarı). Yoksa configured:false döner, hata vermez.
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { cachedFlight, probeProvider } from '../_shared/flight-provider.ts';
import { alertLevel, cacheTtlMin, type FlightStatus, localDate, normalizeFlightNumber } from '../_shared/flight-status.ts';
import { corsHeaders, dbError, error, json } from '../_shared/http.ts';

const MAX_FLIGHTS = 6;
let probe: { at: number; status: number; message: string } | null = null;

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
  const { supabase } = auth;

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
