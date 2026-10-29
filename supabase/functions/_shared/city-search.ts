// Seyahat kurarken şehir arama: Google Places Autocomplete (New) ile yazdıkça şehir önerir; seçilince Place Details ile
// şehrin adı, ülke kodu ve koordinatı alınır. Böylece kullanıcı şehir ve ülkeyi ayrı ayrı seçmez.
import { PLACE_ID_PATTERN, PLACES_API_BASE, PlacesError } from './places.ts';

export const AUTOCOMPLETE_PATH = 'v1/places:autocomplete';

export type CitySuggestion = { place_id: string; name: string; detail: string };
export type CityPick = { name: string; country_code: string; lat: number | null; lng: number | null };

/** Oturum belirteci: öneriler ve seçim aynı oturumda faturalanır (istemci üretir). */
export const SESSION_TOKEN = /^[A-Za-z0-9_-]{8,64}$/;

/** Arama metni: kontrol karakterleri atılır, 2-60 karakter; aksi halde null. */
export function cleanQuery(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  // deno-lint-ignore no-control-regex
  const s = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.length >= 2 && s.length <= 60 ? s : null;
}

export function autocompleteBody(input: string, language: string, sessionToken: string) {
  return { input, languageCode: language, includedPrimaryTypes: ['(cities)'], sessionToken };
}

export const AUTOCOMPLETE_MASK = 'suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat';
export const PICK_MASK = 'id,displayName,addressComponents,location';

const str = (v: unknown, max = 120) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function parseSuggestions(body: unknown): CitySuggestion[] {
  const list = (body as { suggestions?: unknown } | null)?.suggestions;
  if (!Array.isArray(list)) return [];
  const out: CitySuggestion[] = [];
  for (const s of list) {
    // deno-lint-ignore no-explicit-any
    const p = (s as any)?.placePrediction;
    const placeId = str(p?.placeId, 200);
    const main = str(p?.structuredFormat?.mainText?.text) ?? str(p?.text?.text);
    if (!placeId || !PLACE_ID_PATTERN.test(placeId) || !main) continue;
    out.push({ place_id: placeId, name: main, detail: str(p?.structuredFormat?.secondaryText?.text) ?? '' });
    if (out.length >= 6) break;
  }
  return out;
}

/** Place Details yanıtından şehir; ülke kodu (ISO 3166-1 alpha-2) yoksa null (seçim geçersiz sayılır). */
export function parsePick(body: unknown): CityPick | null {
  // deno-lint-ignore no-explicit-any
  const b = body as any;
  const name = str(b?.displayName?.text);
  const components: unknown[] = Array.isArray(b?.addressComponents) ? b.addressComponents : [];
  // deno-lint-ignore no-explicit-any
  const country = components.find((c: any) => Array.isArray(c?.types) && c.types.includes('country')) as any;
  const code = typeof country?.shortText === 'string' ? country.shortText.toUpperCase() : null;
  if (!name || !code || !/^[A-Z]{2}$/.test(code)) return null;
  const lat = typeof b?.location?.latitude === 'number' ? b.location.latitude : null;
  const lng = typeof b?.location?.longitude === 'number' ? b.location.longitude : null;
  return { name, country_code: code, lat, lng };
}

export async function suggestCities(options: { apiKey: string; input: string; language: string; sessionToken: string; fetchImpl?: typeof fetch; apiBase?: string }): Promise<CitySuggestion[]> {
  const res = await (options.fetchImpl ?? fetch)(`${options.apiBase ?? PLACES_API_BASE}/${AUTOCOMPLETE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': options.apiKey, 'X-Goog-FieldMask': AUTOCOMPLETE_MASK },
    body: JSON.stringify(autocompleteBody(options.input, options.language, options.sessionToken)),
    signal: AbortSignal.timeout(8_000),
  }).catch((e) => {
    throw new PlacesError(`autocomplete request failed: ${e instanceof Error ? e.message : String(e)}`, null);
  });
  if (!res.ok) throw new PlacesError(`autocomplete http ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  return parseSuggestions(await res.json());
}

export async function pickCity(options: { apiKey: string; placeId: string; language: string; sessionToken: string; fetchImpl?: typeof fetch; apiBase?: string }): Promise<CityPick | null> {
  if (!PLACE_ID_PATTERN.test(options.placeId)) return null;
  const url = `${options.apiBase ?? PLACES_API_BASE}/v1/places/${options.placeId}?languageCode=${encodeURIComponent(options.language)}&sessionToken=${encodeURIComponent(options.sessionToken)}`;
  const res = await (options.fetchImpl ?? fetch)(url, {
    headers: { 'X-Goog-Api-Key': options.apiKey, 'X-Goog-FieldMask': PICK_MASK },
    signal: AbortSignal.timeout(8_000),
  }).catch((e) => {
    throw new PlacesError(`place details request failed: ${e instanceof Error ? e.message : String(e)}`, null);
  });
  if (!res.ok) throw new PlacesError(`place details http ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  return parsePick(await res.json());
}
