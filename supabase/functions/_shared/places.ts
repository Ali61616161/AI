// Google Places API (New) — Text Search. Yakındaki açık yerler, otel önerileri ve
// AI'ın önerdiği mekanları doğrulama için kullanılır. İstek gövdesindeki ve alan
// maskesindeki her alan google/schema.json'daki resmi şemayla test edilir.
//
// Sunucu sırrı: GOOGLE_MAPS_API_KEY (Places API ve Weather API açık olmalı).
// GOOGLE_PLACES_API_BASE sadece testlerde kullanılır.

export const PLACES_API_BASE = 'https://places.googleapis.com';
export const SEARCH_TEXT_PATH = 'v1/places:searchText';

/** Place nesnesinden istenen alanlar (alan maskesinde "places." ön ekiyle). */
export const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'shortFormattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'priceLevel',
  'googleMapsUri',
  'primaryType',
  'businessStatus',
  'currentOpeningHours.openNow',
] as const;

/** Doğrulamada açık/kapalı bilgisi gerekmez; daha ucuz alan seti. */
export const VERIFY_FIELDS = PLACE_FIELDS.filter((f) => f !== 'currentOpeningHours.openNow');

export function fieldMask(fields: readonly string[]): string {
  return fields.map((f) => `places.${f}`).join(',');
}

export type PriceLevel = 'PRICE_LEVEL_FREE' | 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE';

export type SearchTextRequest = {
  textQuery: string;
  languageCode?: string;
  includedType?: string;
  strictTypeFiltering?: boolean;
  openNow?: boolean;
  minRating?: number;
  priceLevels?: PriceLevel[];
  rankPreference?: 'DISTANCE' | 'RELEVANCE';
  pageSize?: number;
  locationBias?: { circle: { center: { latitude: number; longitude: number }; radius: number } };
};

export type Place = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  mapsUrl: string | null;
  type: string | null;
  status: string | null;
  openNow: boolean | null;
  distanceM: number | null;
};

// ---------------------------------------------------------------------------
// İstekler
// ---------------------------------------------------------------------------

/** "Yakında şu an açık" kategorileri → Places tipi (Table A). */
export const NEARBY_CATEGORIES = {
  restaurant: { type: 'restaurant', query: 'restaurant' },
  cafe: { type: 'cafe', query: 'cafe' },
  museum: { type: 'museum', query: 'museum' },
  attraction: { type: 'tourist_attraction', query: 'tourist attraction' },
  pharmacy: { type: 'pharmacy', query: 'pharmacy' },
  supermarket: { type: 'supermarket', query: 'supermarket' },
  atm: { type: 'atm', query: 'atm' },
} as const;

export type NearbyCategory = keyof typeof NEARBY_CATEGORIES;

export function isNearbyCategory(value: unknown): value is NearbyCategory {
  return typeof value === 'string' && Object.hasOwn(NEARBY_CATEGORIES, value);
}

const circle = (lat: number, lng: number, radius: number) => ({ circle: { center: { latitude: lat, longitude: lng }, radius } });

/** Konuma yakın, şu an açık yerler. searchNearby'de openNow olmadığı için Text Search kullanılır. */
export function openNowRequest(input: { lat: number; lng: number; category: NearbyCategory; language: string; radius?: number }): SearchTextRequest {
  const c = NEARBY_CATEGORIES[input.category];
  return {
    textQuery: c.query,
    includedType: c.type,
    strictTypeFiltering: true,
    openNow: true,
    rankPreference: 'DISTANCE',
    locationBias: circle(input.lat, input.lng, input.radius ?? 1500),
    pageSize: 10,
    languageCode: input.language,
  };
}

const HOTEL_RULES: Record<string, { query: string; minRating: number }> = {
  low: { query: 'budget hotel', minRating: 3.5 },
  mid: { query: 'hotel', minRating: 4 },
  lux: { query: 'luxury hotel', minRating: 4.5 },
};

/**
 * Bütçeye göre otel araması. Oteller için Google çoğu zaman fiyat seviyesi vermediği
 * için priceLevels yerine sorgu ve en düşük puanla filtrelenir.
 */
export function hotelRequest(input: { city: string; budget: string; language: string; lat?: number | null; lng?: number | null }): SearchTextRequest {
  const rule = HOTEL_RULES[input.budget] ?? HOTEL_RULES.mid;
  return {
    textQuery: `${rule.query} in ${input.city}`,
    includedType: 'lodging',
    minRating: rule.minRating,
    rankPreference: 'RELEVANCE',
    pageSize: 8,
    languageCode: input.language,
    ...(input.lat != null && input.lng != null ? { locationBias: circle(input.lat, input.lng, 5000) } : {}),
  };
}

/** AI'ın önerdiği mekanı adıyla bulur; varsa yakın bir konuma göre önceliklendirir. */
export function verifyRequest(input: { placeName: string; city: string | null; language: string; near?: { lat: number; lng: number } | null }): SearchTextRequest {
  return {
    textQuery: input.city && !input.placeName.toLowerCase().includes(input.city.toLowerCase()) ? `${input.placeName}, ${input.city}` : input.placeName,
    pageSize: 1,
    languageCode: input.language,
    ...(input.near ? { locationBias: circle(input.near.lat, input.near.lng, 20000) } : {}),
  };
}

/** Şehrin merkez koordinatı (hava durumu ve otel araması için). */
export function cityRequest(city: string, language: string): SearchTextRequest {
  return { textQuery: city, includedType: 'locality', pageSize: 1, languageCode: language };
}

// ---------------------------------------------------------------------------
// Yanıt
// ---------------------------------------------------------------------------

const PRICE_LEVELS: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** İki koordinat arası yaklaşık mesafe (metre, haversine). */
export function distanceMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * 6_371_000 * Math.asin(Math.sqrt(h)));
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function normalizePlace(raw: unknown, origin?: { lat: number; lng: number } | null): Place | null {
  if (!raw || typeof raw !== 'object') return null;
  // deno-lint-ignore no-explicit-any
  const p = raw as any;
  const id = str(p.id);
  const name = str(p.displayName?.text);
  if (!id || !name) return null;
  const lat = num(p.location?.latitude);
  const lng = num(p.location?.longitude);
  const rating = num(p.rating);
  return {
    id,
    name,
    address: str(p.shortFormattedAddress) ?? str(p.formattedAddress),
    lat,
    lng,
    rating: rating === null ? null : Math.round(Math.min(Math.max(rating, 0), 5) * 10) / 10,
    ratingCount: num(p.userRatingCount),
    priceLevel: typeof p.priceLevel === 'string' && p.priceLevel in PRICE_LEVELS ? PRICE_LEVELS[p.priceLevel] : null,
    mapsUrl: typeof p.googleMapsUri === 'string' && p.googleMapsUri.startsWith('https://') ? p.googleMapsUri : null,
    type: str(p.primaryType),
    status: str(p.businessStatus),
    openNow: typeof p.currentOpeningHours?.openNow === 'boolean' ? p.currentOpeningHours.openNow : null,
    distanceM: origin && lat !== null && lng !== null ? distanceMeters(origin, { lat, lng }) : null,
  };
}

export class PlacesError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export async function searchText(options: {
  apiKey: string;
  body: SearchTextRequest;
  fields?: readonly string[];
  origin?: { lat: number; lng: number } | null;
  fetchImpl?: typeof fetch;
  apiBase?: string;
  timeoutMs?: number;
}): Promise<Place[]> {
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(`${options.apiBase ?? PLACES_API_BASE}/${SEARCH_TEXT_PATH}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-Goog-Api-Key': options.apiKey,
      'X-Goog-FieldMask': fieldMask(options.fields ?? PLACE_FIELDS),
    },
    body: JSON.stringify(options.body),
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  }).catch((e) => {
    throw new PlacesError(`places request failed: ${e instanceof Error ? e.message : String(e)}`, null);
  });
  if (!res.ok) throw new PlacesError(`places http ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  const data = await res.json();
  return (Array.isArray(data?.places) ? data.places : [])
    .map((p: unknown) => normalizePlace(p, options.origin))
    .filter((p: Place | null): p is Place => p !== null);
}

// ---------------------------------------------------------------------------
// Plan kalemlerini doğrulama
// ---------------------------------------------------------------------------

/** Doğrulanacak kalem: place_name'i olan, kilitli olmayan, ulaşım dışı duraklar. */
export type VerifiableItem = {
  kind: string;
  place_name: string | null;
  address?: string | null;
  is_locked: boolean;
  google_place_id?: string | null;
};

export type PlaceFields = {
  google_place_id: string;
  place_name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  rating_count: number | null;
  maps_url: string | null;
  place_status: string | null;
  place_checked_at: string;
};

export function needsVerification(item: VerifiableItem): boolean {
  return Boolean(item.place_name) && !item.is_locked && !item.google_place_id && item.kind !== 'transport' && item.kind !== 'free_time';
}

/** Bulunan mekan, kalemin önerildiği bölgeden çok uzaksa (başka şehirdeki aynı isim) kabul edilmez. */
const MAX_DISTANCE_M = 60_000;

export function placeToFields(place: Place, checkedAt: string): PlaceFields {
  return {
    google_place_id: place.id,
    place_name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    rating: place.rating,
    rating_count: place.ratingCount,
    maps_url: place.mapsUrl,
    place_status: place.status,
    place_checked_at: checkedAt,
  };
}

/**
 * Günlerdeki mekanları Google Places ile doğrular ve kalemlere yer kimliği, konum,
 * puan ve harita bağlantısı ekler. Hata olursa kalem olduğu gibi kalır; doğrulama
 * planın kaydedilmesini asla engellemez. Aynı mekan bir kez sorgulanır.
 */
export async function verifyPlanDays<T extends VerifiableItem, D extends { city: string | null; items: T[] }>(
  days: D[],
  options: {
    apiKey: string;
    language: string;
    /** Şehir adına (küçük harf) göre merkez koordinatı; bulunan mekan buna yakın olmalı. */
    nearByCity?: Record<string, { lat: number; lng: number }>;
    near?: { lat: number; lng: number } | null;
    /** Aynı istek içinde tekrar sorgulamamak için paylaşılan sonuçlar. */
    cache?: Map<string, Place | null>;
    fetchImpl?: typeof fetch;
    apiBase?: string;
    maxLookups?: number;
    concurrency?: number;
    now?: Date;
  },
): Promise<{ days: D[]; lookups: number; verified: number; failed: number }> {
  const checkedAt = (options.now ?? new Date()).toISOString();
  const keyOf = (item: T, city: string | null) => `${item.place_name!.trim().toLowerCase()}|${(city ?? '').toLowerCase()}`;
  const nearOf = (city: string | null) => (city ? options.nearByCity?.[city.toLowerCase()] : undefined) ?? options.near ?? null;
  const results = options.cache ?? new Map<string, Place | null>();
  const queue = new Map<string, { placeName: string; city: string | null; near: { lat: number; lng: number } | null }>();
  for (const day of days) {
    for (const item of day.items) {
      const key = needsVerification(item) ? keyOf(item, day.city) : null;
      if (key && !results.has(key) && !queue.has(key) && queue.size < (options.maxLookups ?? 40)) {
        queue.set(key, { placeName: item.place_name!.trim(), city: day.city, near: nearOf(day.city) });
      }
    }
  }

  let failed = 0;
  const entries = [...queue.entries()];
  let next = 0;
  async function worker() {
    while (next < entries.length) {
      const [key, q] = entries[next++];
      try {
        const [place] = await searchText({
          apiKey: options.apiKey,
          body: verifyRequest({ ...q, language: options.language }),
          fields: VERIFY_FIELDS,
          fetchImpl: options.fetchImpl,
          apiBase: options.apiBase,
        });
        const tooFar = place && q.near && place.lat !== null && place.lng !== null && distanceMeters(q.near, { lat: place.lat, lng: place.lng }) > MAX_DISTANCE_M;
        results.set(key, place && !tooFar ? place : null);
      } catch (e) {
        failed++;
        console.warn('place verification failed', e instanceof Error ? e.message : String(e));
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(options.concurrency ?? 5, entries.length) }, worker));

  let verified = 0;
  const out = days.map((day) => ({
    ...day,
    items: day.items.map((item) => {
      if (!needsVerification(item)) return item;
      const place = results.get(keyOf(item, day.city));
      if (!place) return item;
      verified++;
      return { ...item, ...placeToFields(place, checkedAt), address: place.address ?? item.address ?? null };
    }),
  }));
  return { days: out, lookups: entries.length, verified, failed };
}
