// AeroDataBox çağrısı + paylaşımlı önbellek (flight-status ve flight-watch ortak kullanır).
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { type FlightStatus, parseFlights } from './flight-status.ts';

const HOST = 'aerodatabox.p.rapidapi.com';

export async function fetchFlight(key: string, number: string, date: string, origin: string | null): Promise<FlightStatus | null | 'failed'> {
  try {
    const res = await fetch(`https://${HOST}/flights/number/${number}/${date}?withAircraftImage=false&withLocation=false`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': HOST },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return null; // uçuş bulunamadı
    if (!res.ok) {
      console.error('flight provider', res.status);
      return 'failed';
    }
    return parseFlights(await res.json(), origin);
  } catch (e) {
    console.error('flight provider fetch failed', String(e).slice(0, 120));
    return 'failed';
  }
}

/** Önbellekte `ttlMin` dakikadan tazeyse onu, değilse servisten alıp önbelleğe yazarak döner. */
export async function cachedFlight(
  admin: SupabaseClient,
  key: string,
  q: { number: string; date: string; origin: string; ttlMin: number; now: number },
): Promise<{ status: FlightStatus; checkedAt: string } | null> {
  const { data: cached } = await admin
    .from('flight_status_cache')
    .select('data, fetched_at')
    .eq('flight_number', q.number)
    .eq('flight_date', q.date)
    .eq('origin_code', q.origin)
    .maybeSingle();

  let status: FlightStatus | null = (cached?.data as FlightStatus | null) ?? null;
  let checkedAt: string | null = cached?.fetched_at ?? null;
  if (!(cached && q.now - Date.parse(cached.fetched_at) < q.ttlMin * 60_000)) {
    const result = await fetchFlight(key, q.number, q.date, q.origin || null);
    if (result !== 'failed') {
      status = result;
      checkedAt = new Date().toISOString();
      await admin.from('flight_status_cache').upsert({ flight_number: q.number, flight_date: q.date, origin_code: q.origin, data: status, fetched_at: checkedAt });
    }
  }
  return status && checkedAt ? { status, checkedAt } : null;
}
