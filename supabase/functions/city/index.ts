// Şehrim: yaşanan şehirde akşam/hafta sonu planı ve yakın, bütçeye uygun kaçamaklar.
//
//   POST { "action": "evening", "when": "tonight"|"tomorrow"|"weekend", "companion", "budget",
//          "moods"?: [], "group_size"?: 1-10, "lat"?, "lng"?, "timezone"? }
//     → { city, title, summary, weather, stops[] (Google ile doğrulanmış mekan bilgisiyle) }   (kota: city_plan)
//   POST { "action": "getaways", "days": 1-3, "budget_per_person", "transport": "any"|"public"|"car",
//          "companion", "exclude"?: string[] }
//     → { city, currency, getaways[] (mesafe gerçek koordinatla, yol tarifi ve bilet bağlantıları) }        (kota: getaway)
//
// Şehir, profildeki yaşanan şehirdir (home_city); koordinatı yoksa bir kez bulunup ~1 km
// hassasiyetle profile yazılır. Gerekli sırlar: GEMINI_API_KEY, GOOGLE_MAPS_API_KEY.
import { consumeQuota, userClient } from '../_shared/auth.ts';
import {
  buildEveningPrompt,
  buildGetawayPrompt,
  currencyFor,
  directionsUrl,
  EVENING_RESPONSE_SCHEMA,
  filterGetaways,
  GETAWAY_RESPONSE_SCHEMA,
  MOODS,
  normalizeEveningPlan,
  normalizeGetaways,
  TRANSPORT,
  WHEN,
  type Mood,
} from '../_shared/city.ts';
import { isValidTimeZone, utcToLocal } from '../_shared/documents.ts';
import { googleConfig } from '../_shared/enrich.ts';
import { DEFAULT_GEMINI_MODEL, GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { cityRequest, PlacesError, searchText, verifyPlanDays } from '../_shared/places.ts';
import { ticketOptions, transportTemplatesFromEnv } from '../_shared/transport.ts';
import { fetchCurrent, weatherForPrompt } from '../_shared/weather.ts';

const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
const COMPANIONS = ['solo', 'couple', 'family', 'friends'];
const BUDGETS = ['low', 'mid', 'lux'];

const isCoord = (lat: unknown, lng: unknown) => typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
const round2 = (v: number) => Math.round(v * 100) / 100;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const google = googleConfig();
  if (!geminiKey || !google.apiKey) return error('not_configured', 503, 'GEMINI_API_KEY and GOOGLE_MAPS_API_KEY are required');
  const mapsKey = google.apiKey;

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

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_language, home_currency, home_city, home_country, home_lat, home_lng, default_companion, default_budget')
    .eq('id', user.id)
    .single();
  if (!profile?.home_city) return error('bad_request', 400, 'no_home_city');
  const language: string = profile.preferred_language ?? 'en';
  const city: string = profile.home_city;
  const country: string | null = profile.home_country;
  const currency = currencyFor(country, profile.home_currency ?? 'USD');

  /** Şehir merkezi: profilde yoksa Google'dan bir kez bulunur ve kaydedilir. */
  async function homeCoords(): Promise<{ lat: number; lng: number } | null> {
    if (profile!.home_lat !== null && profile!.home_lng !== null) return { lat: Number(profile!.home_lat), lng: Number(profile!.home_lng) };
    const query = country ? `${city}, ${country}` : city;
    let [place] = await searchText({ apiKey: mapsKey, apiBase: google.placesBase, body: cityRequest(query, language), fields: ['id', 'location'] });
    // Bazı büyük şehirler (ör. İstanbul) Google'da "locality" değil il olarak kayıtlı; türsüz tekrar aranır.
    if (place?.lat == null) [place] = await searchText({ apiKey: mapsKey, apiBase: google.placesBase, body: { textQuery: query, pageSize: 1, languageCode: language }, fields: ['id', 'location'] });
    if (place?.lat == null || place.lng == null) return null;
    await supabase.from('profiles').update({ home_lat: round2(place.lat), home_lng: round2(place.lng) }).eq('id', user.id);
    return { lat: place.lat, lng: place.lng };
  }

  async function ai(prompt: string, schema: unknown) {
    return await generateJson({ apiBase: Deno.env.get('GEMINI_API_BASE'), apiKey: geminiKey!, model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL, prompt, responseSchema: schema, timeoutMs: 60_000 });
  }

  try {
    switch (body.action) {
      case 'evening':
        return await evening();
      case 'getaways':
        return await getaways();
      default:
        return error('bad_request', 400, 'action must be evening or getaways');
    }
  } catch (e) {
    if (e instanceof GeminiError) {
      console.error('city: AI failed', e.message);
      return error('ai_failed', 502, e.message);
    }
    if (e instanceof PlacesError) {
      console.error('city: google failed', e.message);
      return error('upstream_failed', 502);
    }
    throw e;
  }

  async function evening() {
    if (!(WHEN as readonly string[]).includes(body.when)) return error('bad_request', 400, 'unknown when');
    const companion = COMPANIONS.includes(body.companion) ? body.companion : (profile!.default_companion ?? 'solo');
    const budget = BUDGETS.includes(body.budget) ? body.budget : (profile!.default_budget ?? 'mid');
    const moods: Mood[] = (Array.isArray(body.moods) ? body.moods : []).filter((m: unknown): m is Mood => (MOODS as readonly unknown[]).includes(m)).slice(0, 4);
    const groupSize = Number.isInteger(body.group_size) && body.group_size >= 1 && body.group_size <= 10 ? body.group_size : companion === 'couple' ? 2 : 1;
    const timezone = typeof body.timezone === 'string' && isValidTimeZone(body.timezone) ? body.timezone : 'UTC';

    const origin = isCoord(body.lat, body.lng) ? { lat: body.lat as number, lng: body.lng as number } : await homeCoords();
    if (!origin) return error('bad_request', 400, 'city not found');
    const quota = await consumeQuota(supabase, 'city_plan', null);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const weather = await fetchCurrent({ ...origin, language, apiKey: mapsKey, apiBase: google.weatherBase }).catch(() => null);
    const now = new Date();
    const localNow = utcToLocal(now.toISOString(), timezone).replace('T', ' ');
    const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone }).format(now);
    const plan = normalizeEveningPlan(
      await ai(buildEveningPrompt({ city, countryCode: country, language, currency, localNow, weekday, weather: weatherForPrompt(weather) }, { when: body.when, companion, budget, moods, groupSize }), EVENING_RESPONSE_SCHEMA),
    );
    if (!plan.stops.length) return error('ai_failed', 502, 'empty plan');

    // Mekanlar Google ile doğrulanır; kalıcı kapalı olanlar plandan çıkar.
    const verified = await verifyPlanDays(
      [{ city, items: plan.stops.map((s) => ({ ...s, kind: 'activity', place_name: s.placeName, is_locked: false })) }],
      { apiKey: mapsKey, apiBase: google.placesBase, language, near: origin, maxLookups: 8 },
    );
    // deno-lint-ignore no-explicit-any
    const stops = verified.days[0].items as any[];
    return json({
      city,
      currency,
      title: plan.title,
      summary: plan.summary,
      weather: weather ? { temperature: weather.temperature, description: weather.description ?? weather.condition, rainChance: weather.rainChance } : null,
      stops: stops
        .filter((s) => s.place_status !== 'CLOSED_PERMANENTLY')
        .map((s) => ({
          time: s.time,
          duration_min: s.durationMin,
          kind: s.kind,
          title: s.title,
          place_name: s.place_name,
          neighborhood: s.neighborhood,
          why: s.why,
          est_cost: s.estCost,
          indoor: s.indoor,
          google_place_id: s.google_place_id ?? null,
          address: s.address ?? null,
          lat: s.lat ?? null,
          lng: s.lng ?? null,
          rating: s.rating ?? null,
          rating_count: s.rating_count ?? null,
          maps_url: s.maps_url ?? null,
        })),
      quota: { plan: quota.plan, remaining: quota.remaining },
    });
  }

  async function getaways() {
    const days = Number.isInteger(body.days) && body.days >= 1 && body.days <= 3 ? body.days : null;
    const budgetPerPerson = typeof body.budget_per_person === 'number' && body.budget_per_person > 0 && body.budget_per_person <= 10_000_000 ? Math.round(body.budget_per_person) : null;
    if (!days || !budgetPerPerson) return error('bad_request', 400, 'days (1-3) and budget_per_person are required');
    const transport = (TRANSPORT as readonly string[]).includes(body.transport) ? body.transport : 'any';
    const companion = COMPANIONS.includes(body.companion) ? body.companion : (profile!.default_companion ?? 'solo');
    const exclude = (Array.isArray(body.exclude) ? body.exclude : []).filter((x: unknown): x is string => typeof x === 'string' && x.length <= 80).slice(0, 12);

    const origin = await homeCoords();
    if (!origin) return error('bad_request', 400, 'city not found');
    const quota = await consumeQuota(supabase, 'getaway', null);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const month = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(new Date());
    const list = normalizeGetaways(await ai(buildGetawayPrompt({ city, countryCode: country, language, currency }, { days, budgetPerPerson, transport, companion, month }, exclude), GETAWAY_RESPONSE_SCHEMA), days);

    // Her yerin gerçek koordinatı; bulunamayan veya çok uzak çıkan elenir.
    const coords: Record<string, { lat: number; lng: number } | null> = {};
    await Promise.all(
      list.slice(0, 8).map(async (g) => {
        try {
          const [place] = await searchText({ apiKey: mapsKey, apiBase: google.placesBase, body: cityRequest(g.countryCode ? `${g.city}, ${g.countryCode}` : g.city, language), fields: ['id', 'location'] });
          coords[g.city.toLowerCase()] = place?.lat != null && place.lng != null ? { lat: place.lat, lng: place.lng } : null;
        } catch {
          coords[g.city.toLowerCase()] = null;
        }
      }),
    );
    const out = filterGetaways(list, origin, coords, { days, budgetPerPerson });
    const templates = transportTemplatesFromEnv((name) => Deno.env.get(name));
    return json({
      city,
      currency,
      days,
      budget_per_person: budgetPerPerson,
      getaways: out.map((g) => ({
        ...g,
        directionsUrl: directionsUrl(country ? `${city}, ${country}` : city, g.countryCode ? `${g.city}, ${g.countryCode}` : g.city, g.travelMode),
        // Bilet (tren/otobüs/feribot/uçak) veya araç kiralama bağlantıları; bölgeye göre ortak.
        tickets: ticketOptions({ mode: g.travelMode, from: city, to: g.city, country, lang: language }, templates, 3),
      })),
      quota: { plan: quota.plan, remaining: quota.remaining },
    });
  }
});
