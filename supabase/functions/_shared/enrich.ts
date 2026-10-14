// AI'ın ürettiği planı gerçek dünyaya bağlar: mekanları Google Places ile doğrular
// (yer kimliği, konum, puan, harita bağlantısı) ve bilet alınabilen duraklara
// bilet bağlantısı ekler. GOOGLE_MAPS_API_KEY yoksa doğrulama atlanır; plan yine
// kaydedilir. Hiçbir hata planın kaydedilmesini engellemez.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import { addTicketLinks, templatesFromEnv } from './affiliate.ts';
import { cityRequest, searchText, verifyPlanDays, type Place, type VerifiableItem } from './places.ts';
import type { TripDestination } from './trip-context.ts';

export function googleConfig() {
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY') ?? null;
  return {
    apiKey,
    placesBase: Deno.env.get('GOOGLE_PLACES_API_BASE') || undefined,
    weatherBase: Deno.env.get('GOOGLE_WEATHER_API_BASE') || undefined,
  };
}

type Coords = { lat: number; lng: number };

/**
 * Seyahat şehirlerinin merkez koordinatları. Bilinmeyenler Google'dan bir kez
 * bulunur ve trip_destinations'a yazılır (sonraki isteklerde sorgu gerekmez).
 */
export async function destinationCoords(supabase: SupabaseClient, destinations: TripDestination[], language: string): Promise<Record<string, Coords>> {
  const out: Record<string, Coords> = {};
  const { apiKey, placesBase } = googleConfig();
  for (const d of destinations) {
    if (d.lat !== null && d.lng !== null) {
      out[d.city.toLowerCase()] = { lat: d.lat, lng: d.lng };
      continue;
    }
    if (!apiKey) continue;
    try {
      const [place] = await searchText({ apiKey, apiBase: placesBase, body: cityRequest(d.country_code ? `${d.city}, ${d.country_code}` : d.city, language), fields: ['id', 'displayName', 'location'] });
      if (place?.lat == null || place.lng == null) continue;
      out[d.city.toLowerCase()] = { lat: place.lat, lng: place.lng };
      await supabase
        .from('trip_destinations')
        .update({ location: `SRID=4326;POINT(${place.lng} ${place.lat})`, google_place_id: place.id })
        .eq('id', d.id);
    } catch (e) {
      console.warn('city lookup failed', d.city, e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}

type Item = VerifiableItem & { title: string; affiliate_partner: string | null; booking_url?: string | null };

export async function enrichDays<T extends Item, D extends { city: string | null; items: T[] }>(
  days: D[],
  options: { language: string; nearByCity?: Record<string, Coords>; near?: Coords | null; cache?: Map<string, Place | null> },
): Promise<D[]> {
  const { apiKey, placesBase } = googleConfig();
  let out = days;
  if (apiKey) {
    const result = await verifyPlanDays(days, { apiKey, apiBase: placesBase, ...options });
    console.log(`places: ${result.verified} verified, ${result.lookups} lookups, ${result.failed} failed`);
    out = result.days;
  }
  return addTicketLinks(out, templatesFromEnv((name) => Deno.env.get(name)), options.language);
}
