// Yaşanılan şehirden fırsatlar: en ucuz uçuş bulunan yerler ve bilet sitesi bağlantıları.
//
//   POST { "city": "İstanbul" | "origin": "IST", "currency": "EUR", "language": "tr" }
//     → { configured, origin: { code, name }, currency, deals: [{ code, city, country_code, price, depart_on, return_on, airline, url }] }
//
// Giriş yapmış kullanıcı gerekir. Sonuçlar 3 saat sunucu belleğinde tutulur (aynı şehirden gelen herkese tek sorgu).
// Sırlar: TRAVELPAYOUTS_TOKEN (Data API; yoksa configured:false), TRAVELPAYOUTS_MARKER (isteğe bağlı ortak numarası; bağlantılara eklenir).
import { userClient } from '../_shared/auth.ts';
import { aviasalesUrl, DEAL_LOCALES, fetchDeals, isIata, lookupCity, type Deal, type PlaceName } from '../_shared/deals.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';

const TTL_MS = 3 * 3600_000;
type Cached = { at: number; deals: Deal[] };
const dealCache = new Map<string, Cached>();
const nameCache = new Map<string, { at: number; place: PlaceName | null }>();

async function cityName(code: string, language: string): Promise<PlaceName | null> {
  const key = `${language}:${code}`;
  const hit = nameCache.get(key);
  if (hit && Date.now() - hit.at < 24 * 3600_000) return hit.place;
  const place = await lookupCity(code, language).catch(() => null);
  if (nameCache.size > 2000) nameCache.clear();
  nameCache.set(key, { at: Date.now(), place });
  return place;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  if (!(await userClient(req))) return error('unauthorized', 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  const token = Deno.env.get('TRAVELPAYOUTS_TOKEN');
  if (!token) return json({ configured: false, deals: [] });

  const language = typeof body?.language === 'string' && DEAL_LOCALES.has(body.language) ? body.language : 'en';
  const currency = typeof body?.currency === 'string' && /^[A-Za-z]{3}$/.test(body.currency) ? body.currency.toUpperCase() : 'EUR';
  let origin: PlaceName | null = null;
  if (isIata(body?.origin)) origin = await cityName(body.origin, language);
  else if (typeof body?.city === 'string') origin = await lookupCity(body.city, language).catch(() => null);
  if (!origin) return json({ configured: true, origin: null, currency, deals: [] });

  const key = `${origin.code}|${currency}`;
  let cached = dealCache.get(key);
  if (!cached || Date.now() - cached.at > TTL_MS) {
    try {
      cached = { at: Date.now(), deals: await fetchDeals(token, origin.code, currency) };
    } catch (e) {
      console.error('deals: provider', String(e).slice(0, 120));
      return error('upstream_failed', 502);
    }
    if (dealCache.size > 200) dealCache.clear();
    dealCache.set(key, cached);
  }

  const marker = Deno.env.get('TRAVELPAYOUTS_MARKER') ?? null;
  const from = origin;
  const deals = await Promise.all(
    cached.deals.map(async (d) => {
      const place = await cityName(d.destination, language);
      return {
        code: d.destination,
        city: place?.name ?? d.destination,
        country_code: place?.countryCode ?? null,
        price: d.price,
        depart_on: d.departOn,
        return_on: d.returnOn,
        airline: d.airline,
        url: aviasalesUrl({ origin: from.code, destination: d.destination, departOn: d.departOn, returnOn: d.returnOn, marker }),
      };
    }),
  );
  return json({ configured: true, origin: { code: origin.code, name: origin.name }, currency, deals });
});
