// "İstanbul'dan fırsatlar": yaşanılan şehirden en ucuz uçuş bulunan yerler (Travelpayouts/Aviasales Data API) ve
// bilet sitesine giden bağlantı. Ağ çağrısı yapan kısımlar fetchImpl alır (testlerde sahte verilir); kalanlar saf işlevlerdir.

export type Deal = { destination: string; price: number; departOn: string; returnOn: string | null; airline: string | null };

const API = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';
const AUTOCOMPLETE = 'https://autocomplete.travelpayouts.com/places2';
export const DEAL_LOCALES = new Set(['en', 'ru', 'de', 'es', 'fr', 'it', 'tr', 'zh', 'ar']);
export const MAX_DEALS = 10;

const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}-\d{2}/;

export const isIata = (v: unknown): v is string => typeof v === 'string' && IATA.test(v);

/** Kalkış şehrinden yönlere göre en ucuz biletler (her yön bir kez, fiyata göre). */
export function buildDealsUrl(origin: string, currency: string): string {
  const params = new URLSearchParams({ origin, currency: currency.toLowerCase(), one_way: 'false', sorting: 'price', unique: 'true', limit: '40' });
  return `${API}?${params}`;
}

/** Sağlayıcı yanıtından fırsatlar: geçerli, kalkış şehrinden farklı, her yön bir kez, en ucuzdan; en çok MAX_DEALS. */
export function parseDeals(body: unknown, origin: string): Deal[] {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return [];
  const best = new Map<string, Deal>();
  for (const row of data as Record<string, unknown>[]) {
    const destination = row?.destination;
    const price = Number(row?.price);
    const departure = row?.departure_at;
    if (!isIata(destination) || destination === origin) continue;
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) continue;
    if (typeof departure !== 'string' || !DATE.test(departure)) continue;
    const back = typeof row?.return_at === 'string' && DATE.test(row.return_at) ? row.return_at.slice(0, 10) : null;
    const airline = typeof row?.airline === 'string' && /^[A-Z0-9]{2,3}$/i.test(row.airline) ? row.airline.toUpperCase() : null;
    const deal: Deal = { destination, price: Math.round(price * 100) / 100, departOn: departure.slice(0, 10), returnOn: back, airline };
    const prev = best.get(destination);
    if (!prev || deal.price < prev.price) best.set(destination, deal);
  }
  return [...best.values()].sort((a, b) => a.price - b.price).slice(0, MAX_DEALS);
}

/** Aviasales arama bağlantısı (IST1312ROM17121: kalkış, gün-ay, varış, dönüş gün-ay, yolcu sayısı). Ortak numarası (marker) verilmişse eklenir. */
export function aviasalesUrl(input: { origin: string; destination: string; departOn: string; returnOn: string | null; marker?: string | null }): string {
  const ddmm = (iso: string) => `${iso.slice(8, 10)}${iso.slice(5, 7)}`;
  const path = `${input.origin}${ddmm(input.departOn)}${input.destination}${input.returnOn ? ddmm(input.returnOn) : ''}1`;
  const marker = input.marker && /^[A-Za-z0-9._-]{1,40}$/.test(input.marker) ? `?marker=${encodeURIComponent(input.marker)}` : '';
  return `https://www.aviasales.com/search/${path}${marker}`;
}

export async function fetchDeals(token: string, origin: string, currency: string, fetchImpl: typeof fetch = fetch): Promise<Deal[]> {
  const res = await fetchImpl(buildDealsUrl(origin, currency), { headers: { 'x-access-token': token, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`deals provider HTTP ${res.status}`);
  return parseDeals(await res.json(), origin);
}

export type PlaceName = { code: string; name: string; countryCode: string | null };

/** Şehir adından ya da IATA kodundan şehir (ücretsiz Aviasales arama). Bulunamazsa null. */
export async function lookupCity(term: string, language: string, fetchImpl: typeof fetch = fetch): Promise<PlaceName | null> {
  const q = term.trim().slice(0, 80);
  if (q.length < 2) return null;
  const locale = DEAL_LOCALES.has(language) ? language : 'en';
  const res = await fetchImpl(`${AUTOCOMPLETE}?term=${encodeURIComponent(q)}&locale=${locale}&types[]=city`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const rows = (await res.json()) as { type?: string; code?: string; name?: string; country_code?: string }[];
  const exact = isIata(q.toUpperCase()) ? rows.find((r) => r.type === 'city' && r.code === q.toUpperCase()) : undefined;
  const hit = exact ?? rows.find((r) => r.type === 'city' && isIata(r.code) && typeof r.name === 'string');
  if (!hit || !isIata(hit.code) || typeof hit.name !== 'string') return null;
  return { code: hit.code, name: hit.name.slice(0, 80), countryCode: typeof hit.country_code === 'string' && /^[A-Z]{2}$/.test(hit.country_code) ? hit.country_code : null };
}
