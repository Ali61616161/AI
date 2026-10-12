// Harita ve çevre bilgileri: yakında şu an açık yerler, bütçeye göre otel önerileri
// ve seyahat günleri için hava durumu.
//
//   POST { "action": "open_now", "lat", "lng", "category": "restaurant" | "cafe" | ... }
//     → { places[] }                         (kota: nearby_search)
//   POST { "action": "hotels", "trip_id", "destination_id"? }
//     → { city, checkin, checkout, places[] (booking_url ile) }   (kota: nearby_search)
//   POST { "action": "weather", "trip_id" }  veya  { "action": "weather", "lat", "lng" }
//     → { days[]: { date, city, max, min, condition, description, iconUri, rainChance },
//         available_from }  (tahmin en fazla 10 gün ileriyi kapsar)
//
// Gerekli sunucu sırrı: GOOGLE_MAPS_API_KEY. İsteğe bağlı: AFFILIATE_BOOKING_URL.
import { hotelLink, templatesFromEnv } from '../_shared/affiliate.ts';
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { destinationCoords, googleConfig } from '../_shared/enrich.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { hotelRequest, isNearbyCategory, openNowRequest, PlacesError, searchText } from '../_shared/places.ts';
import type { TripDestination } from '../_shared/trip-context.ts';
import { fetchForecast, MAX_FORECAST_DAYS } from '../_shared/weather.ts';

const TRIP_SELECT =
  'id, start_date, end_date, budget_tier, companion_type, adults, children, ' +
  'trip_destinations(id, city, country_code, arrive_on, depart_on, position, lat, lng)';

type Trip = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  budget_tier: string;
  companion_type: string;
  adults: number;
  children: number;
  trip_destinations: (TripDestination & { arrive_on: string | null; depart_on: string | null; position: number })[];
};

const isCoord = (lat: unknown, lng: unknown) =>
  typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

const addDays = (date: string, n: number) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const google = googleConfig();
  if (!google.apiKey) return error('not_configured', 503, 'GOOGLE_MAPS_API_KEY is not set');
  const apiKey = google.apiKey;

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

  const { data: profile } = await supabase.from('profiles').select('preferred_language').eq('id', user.id).single();
  const language: string = profile?.preferred_language ?? 'en';

  async function loadTrip(): Promise<Trip | null> {
    if (typeof body.trip_id !== 'string') return null;
    const { data } = await supabase.from('trips').select(TRIP_SELECT).eq('id', body.trip_id).maybeSingle();
    if (!data) return null;
    const trip = data as unknown as Trip;
    trip.trip_destinations.sort((a, b) => a.position - b.position);
    return trip;
  }

  try {
    switch (body.action) {
      case 'open_now':
        return await openNow();
      case 'hotels':
        return await hotels();
      case 'weather':
        return await weather();
      default:
        return error('bad_request', 400, 'action must be open_now, hotels or weather');
    }
  } catch (e) {
    if (e instanceof PlacesError) {
      console.error('places: google failed', e.message);
      return error('upstream_failed', 502);
    }
    throw e;
  }

  async function openNow() {
    if (!isCoord(body.lat, body.lng)) return error('bad_request', 400, 'lat and lng are required');
    if (!isNearbyCategory(body.category)) return error('bad_request', 400, 'unknown category');
    const quota = await consumeQuota(supabase, 'nearby_search', null);
    if (!quota.allowed) return error('quota_exceeded', 402);
    const origin = { lat: body.lat, lng: body.lng };
    const places = await searchText({ apiKey, apiBase: google.placesBase, body: openNowRequest({ ...origin, category: body.category, language }), origin });
    // Google openNow filtresine rağmen kapalı veya kalıcı kapalı dönebilir; elenir.
    const open = places.filter((p) => p.openNow !== false && p.status !== 'CLOSED_PERMANENTLY' && p.status !== 'CLOSED_TEMPORARILY');
    return json({ places: open, quota: { plan: quota.plan, remaining: quota.remaining } });
  }

  async function hotels() {
    const trip = await loadTrip();
    if (!trip) return error('not_found', 404);
    const destination = trip.trip_destinations.find((d) => d.id === body.destination_id) ?? trip.trip_destinations[0];
    if (!destination) return error('bad_request', 400, 'trip has no destination');
    const quota = await consumeQuota(supabase, 'nearby_search', trip.id);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const coords = (await destinationCoords(supabase, [destination], language))[destination.city.toLowerCase()];
    const places = await searchText({
      apiKey,
      apiBase: google.placesBase,
      body: hotelRequest({ city: destination.city, budget: trip.budget_tier, language, lat: coords?.lat, lng: coords?.lng }),
      origin: coords ?? null,
    });
    const checkin = destination.arrive_on ?? trip.start_date;
    const checkout = destination.depart_on ?? trip.end_date;
    const templates = templatesFromEnv((name) => Deno.env.get(name));
    // Kişi sayısı girilmemişse yol arkadaşı tipinden tahmin edilir (çift = 2 yetişkin).
    const adults = Math.max(trip.adults ?? 1, trip.companion_type === 'solo' ? 1 : 2);
    return json({
      city: destination.city,
      budget: trip.budget_tier,
      checkin,
      checkout,
      places: places
        .filter((p) => p.status !== 'CLOSED_PERMANENTLY')
        .map((p) => ({
          ...p,
          booking_url: hotelLink(templates, { name: p.name, city: destination.city, checkin, checkout, adults, children: trip.children ?? 0, lang: language }),
        })),
      quota: { plan: quota.plan, remaining: quota.remaining },
    });
  }

  async function weather() {
    const today = new Date().toISOString().slice(0, 10);
    const lastForecastDay = addDays(today, MAX_FORECAST_DAYS - 1);

    if (isCoord(body.lat, body.lng)) {
      const quota = await consumeQuota(supabase, 'weather', null);
      if (!quota.allowed) return error('quota_exceeded', 402);
      const days = await fetchForecast({ lat: body.lat, lng: body.lng, days: 5, language, apiKey, apiBase: google.weatherBase });
      return json({ days: days.map((d) => ({ ...d, city: null })), available_from: null });
    }

    const trip = await loadTrip();
    if (!trip) return error('not_found', 404);
    if (!trip.start_date || !trip.end_date || trip.end_date < today) return json({ days: [], available_from: null });
    if (trip.start_date > lastForecastDay) return json({ days: [], available_from: addDays(trip.start_date, -(MAX_FORECAST_DAYS - 1)) });
    const quota = await consumeQuota(supabase, 'weather', trip.id);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const coords = await destinationCoords(supabase, trip.trip_destinations, language);
    const days = [];
    // Her şehir için o şehirde geçirilen günlerin tahmini (bir şehir bir istek).
    for (const d of trip.trip_destinations) {
      const c = coords[d.city.toLowerCase()];
      if (!c) continue;
      const from = d.arrive_on ?? trip.start_date;
      const to = d.depart_on ?? trip.end_date;
      if (to < today || from > lastForecastDay) continue;
      const span = Math.round((Date.parse(`${to < lastForecastDay ? to : lastForecastDay}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000) + 1;
      const forecast = await fetchForecast({ ...c, days: span, language, apiKey, apiBase: google.weatherBase });
      for (const f of forecast) if (f.date >= from && f.date <= to) days.push({ ...f, city: d.city });
    }
    // Şehir değiştirilen günde ikinci şehrin (varış) tahmini öncelikli.
    const byDate = new Map(days.map((d) => [d.date, d]));
    return json({ days: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)), available_from: null });
  }
});
