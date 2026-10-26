// Seyahatteki yaklaşan uçuşların canlı durumu (gecikme, iptal, kapı, terminal, bagaj bandı).
//
//   POST { "trip_id" } → { configured: boolean, flights: [{ reservation_id, flight_number, checked_at, status, alert }] }
//
// Yalnızca kullanıcının erişebildiği seyahatin uçuşları sorgulanır (keyfi uçuş sorgulanamaz). Sonuçlar paylaşımlı
// önbellekte tutulur; kalkışa 24 saatten fazla olan uçuşlar sorgulanmaz.
// Gerekli sunucu sırrı: AERODATABOX_KEY (RapidAPI anahtarı). Yoksa configured:false döner, hata vermez.
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { alertLevel, cacheTtlMin, type FlightStatus, localDate, normalizeFlightNumber, parseFlights } from '../_shared/flight-status.ts';
import { corsHeaders, dbError, error, json } from '../_shared/http.ts';

const HOST = 'aerodatabox.p.rapidapi.com';
const MAX_FLIGHTS = 6;

type Reservation = {
  id: string;
  starts_at: string;
  ends_at: string | null;
  start_timezone: string | null;
  origin_code: string | null;
  details: Record<string, unknown> | null;
};

async function fetchStatus(key: string, number: string, date: string, origin: string | null): Promise<FlightStatus | null | 'failed'> {
  try {
    const res = await fetch(`https://${HOST}/flights/number/${number}/${date}?withAircraftImage=false&withLocation=false`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null; // uçuş bulunamadı
    if (!res.ok) {
      console.error('flight-status: provider', res.status);
      return 'failed';
    }
    return parseFlights(await res.json(), origin);
  } catch (e) {
    console.error('flight-status: fetch failed', String(e).slice(0, 120));
    return 'failed';
  }
}

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
  if (typeof body?.trip_id !== 'string') return error('bad_request', 400, 'trip_id is required');

  const key = Deno.env.get('AERODATABOX_KEY');
  const admin = adminClient();
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
    const { data: cached } = await admin
      .from('flight_status_cache')
      .select('data, fetched_at')
      .eq('flight_number', number)
      .eq('flight_date', date)
      .eq('origin_code', origin)
      .maybeSingle();

    let status: FlightStatus | null = (cached?.data as FlightStatus | null) ?? null;
    let checkedAt: string | null = cached?.fetched_at ?? null;
    const fresh = cached && now - Date.parse(cached.fetched_at) < ttl * 60_000;
    if (!fresh) {
      const result = await fetchStatus(key, number, date, origin || null);
      if (result !== 'failed') {
        status = result;
        checkedAt = new Date().toISOString();
        await admin.from('flight_status_cache').upsert({ flight_number: number, flight_date: date, origin_code: origin, data: status, fetched_at: checkedAt });
      }
    }
    if (status && checkedAt) out.push({ reservation_id: r.id, flight_number: number, checked_at: checkedAt, status, alert: alertLevel(status) });
  }
  return json({ configured: true, flights: out });
});
