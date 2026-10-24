// Harita ve çevre bilgileri: yakında şu an açık yerler, bütçeye göre otel önerileri
// ve seyahat günleri için hava durumu.
//
//   POST { "action": "open_now", "lat", "lng", "category": "restaurant" | "cafe" | ..., "radius"?: 300-20000 m, "keyword"?: serbest istek (≤60), "limit"?: 10 | 20 }
//     → { places[] }                         (kota: nearby_search)
//   POST { "action": "hotels", "trip_id", "destination_id"? }
//     → { city, checkin, checkout, places[] (booking_url ile) }   (kota: nearby_search)
//   POST { "action": "place", "place_id" }
//     → { place: { ad, puan, saatler, web, telefon, özet, photos[] (en fazla 4, kısa ömürlü adresler) } }   (kota: place_details)
//   POST { "action": "weather", "trip_id" }  veya  { "action": "weather", "lat", "lng" }
//     → { days[]: { date, city, max, min, condition, description, iconUri, rainChance },
//         available_from }  (tahmin en fazla 10 gün ileriyi kapsar)
//   POST { "action": "route", "origin": {lat,lng}|{address}, "destination": {lat,lng}|{address},
//          "mode"?: "transit"|"drive"|"walk", "depart_at"?: ISO, "origin_name"?, "destination_name"?,
//          "country_code"?: kalkış ülkesi (bilet ortağı seçimi) }
//     → { routes[] (adımlar, hatlar, işletmeci siteleri, uzun yol adımlarında bilet bağlantıları),
//         tickets[] (uzak yerler için uçak/tren/otobüs/feribot), navigation_url }   (kota: route)
//
// Gerekli sunucu sırrı: GOOGLE_MAPS_API_KEY (Routes API açık olmalı).
// İsteğe bağlı: AFFILIATE_BOOKING_URL ve _shared/transport.ts'teki ulaşım ortakları.
import { hotelLink, templatesFromEnv } from '../_shared/affiliate.ts';
import { adminClient } from '../_shared/admin.ts';
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { cleanNote } from '../_shared/itinerary.ts';
import { destinationCoords, googleConfig, MAX_LOOKUP_DESTINATIONS } from '../_shared/enrich.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { distanceMeters, fetchPhotoUri, fetchPlaceDetails, hotelRequest, isNearbyCategory, openNowRequest, PLACE_ID_PATTERN, PlacesError, searchText } from '../_shared/places.ts';
import { computeRoutes, type RouteMode, type RoutePoint, RoutesError, type VehicleKind } from '../_shared/routes.ts';
import type { TripDestination } from '../_shared/trip-context.ts';
import { navigationUrl, type TicketMode, type TicketOption, ticketOptions, transportTemplatesFromEnv } from '../_shared/transport.ts';
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

/** İstekteki konum: koordinat veya adres metni (en fazla 200 karakter). */
function routePoint(v: unknown): RoutePoint | null {
  // deno-lint-ignore no-explicit-any
  const p = v as any;
  if (p && isCoord(p.lat, p.lng)) return { lat: p.lat, lng: p.lng };
  if (p && typeof p.address === 'string' && p.address.trim()) return { address: p.address.trim().slice(0, 200) };
  return null;
}

const cleanName = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 120) : null);

const TICKET_MODE: Partial<Record<VehicleKind, TicketMode>> = { train: 'train', high_speed_train: 'train', bus: 'bus', ferry: 'ferry' };

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
      case 'route':
        return await route();
      case 'place':
        return await placeCard();
      default:
        return error('bad_request', 400, 'action must be open_now, hotels, weather, route or place');
    }
  } catch (e) {
    if (e instanceof RoutesError) {
      console.error('places: routes failed', e.message);
      return error('upstream_failed', 502);
    }
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
    // Harita ve "Kararsızım" daha geniş alan ve daha çok sonuç isteyebilir (aynı ücret).
    const radius = typeof body.radius === 'number' && Number.isFinite(body.radius) ? Math.min(Math.max(Math.round(body.radius), 300), 20_000) : undefined;
    const pageSize = body.limit === 20 ? 20 : 10;
    const places = await searchText({ apiKey, apiBase: google.placesBase, body: openNowRequest({ ...origin, category: body.category, language, radius, pageSize, keyword: cleanNote(body.keyword, 60) }), origin });
    // Google openNow filtresine rağmen kapalı veya kalıcı kapalı dönebilir; elenir.
    const open = places.filter((p) => p.openNow !== false && p.status !== 'CLOSED_PERMANENTLY' && p.status !== 'CLOSED_TEMPORARILY');
    // Buluşma davetleri yalnızca burada Google'dan gelen gerçek işletmelere yapılabilir: ad ve konum
    // sunucuda saklanır, davet bu kaydı kullanır (istemci sahte ad/konum gönderemez).
    const verified = open
      .filter((p) => p.lat !== null && p.lng !== null && /^[A-Za-z0-9_-]{10,255}$/.test(p.id) && p.name)
      .map((p) => ({ google_place_id: p.id, name: p.name.slice(0, 200), location: `SRID=4326;POINT(${p.lng} ${p.lat})`, verified_at: new Date().toISOString() }));
    if (verified.length) {
      const { error: verifyError } = (await adminClient()?.from('verified_places').upsert(verified, { onConflict: 'google_place_id' })) ?? { error: null };
      if (verifyError) console.warn('places: verified_places upsert failed', verifyError.message);
    }
    return json({ places: open, quota: { plan: quota.plan, remaining: quota.remaining } });
  }

  async function placeCard() {
    if (typeof body.place_id !== 'string' || !PLACE_ID_PATTERN.test(body.place_id)) return error('bad_request', 400, 'place_id is required');
    const quota = await consumeQuota(supabase, 'place_details', null);
    if (!quota.allowed) return error('quota_exceeded', 402);
    const details = await fetchPlaceDetails({ apiKey, apiBase: google.placesBase, placeId: body.place_id, language });
    if (!details) return error('not_found', 404);
    // Fotoğraf adresleri paralel alınır; biri başarısız olsa kart yine gösterilir.
    const settled = await Promise.allSettled(details.photoRefs.map((ref) => fetchPhotoUri({ apiKey, apiBase: google.placesBase, photoName: ref.name })));
    const photos = details.photoRefs.flatMap((ref, i) => {
      const r = settled[i];
      return r.status === 'fulfilled' && r.value ? [{ uri: r.value, author: ref.author, authorUrl: ref.authorUrl }] : [];
    });
    const { photoRefs: _refs, ...place } = details;
    return json({ place: { ...place, photos }, quota: { plan: quota.plan, remaining: quota.remaining } });
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
    for (const d of trip.trip_destinations.slice(0, MAX_LOOKUP_DESTINATIONS)) {
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

  async function route() {
    const origin = routePoint(body.origin);
    const destination = routePoint(body.destination);
    if (!origin || !destination) return error('bad_request', 400, 'origin and destination are required');
    const mode: RouteMode = body.mode === 'drive' || body.mode === 'walk' ? body.mode : 'transit';
    const departAt = typeof body.depart_at === 'string' && !Number.isNaN(Date.parse(body.depart_at)) ? body.depart_at : null;
    const country = typeof body.country_code === 'string' && /^[A-Za-z]{2}$/.test(body.country_code) ? body.country_code.toUpperCase() : null;
    const originName = cleanName(body.origin_name) ?? ('address' in origin ? origin.address : null);
    const destinationName = cleanName(body.destination_name) ?? ('address' in destination ? destination.address : null);

    const quota = await consumeQuota(supabase, 'route', null);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const templates = transportTemplatesFromEnv((name) => Deno.env.get(name));
    const routes = await computeRoutes({ apiKey, apiBase: Deno.env.get('GOOGLE_ROUTES_API_BASE') || undefined, origin, destination, mode, departAt, language });
    const date = departAt?.slice(0, 10) ?? null;

    // Şehirlerarası tren/otobüs ve feribot adımlarına bilet bağlantısı eklenir.
    const withTickets = routes.map((r) => ({
      ...r,
      steps: r.steps.map((s) => {
        const ticketMode = s.transit?.longDistance ? TICKET_MODE[s.transit.vehicle] : undefined;
        const tickets = ticketMode && s.transit?.from && s.transit.to
          ? ticketOptions({ mode: ticketMode, from: s.transit.from, to: s.transit.to, country, date: s.transit.departTime?.slice(0, 10) ?? date, lang: language }, templates, 2)
          : [];
        return { ...s, tickets };
      }),
    }));

    // Uzak yerler (veya toplu taşımayla ulaşılamayan yerler) için yolculuk bilet seçenekleri.
    const km = 'lat' in origin && 'lat' in destination ? distanceMeters(origin, destination) / 1000 : null;
    const far = km === null ? routes.length === 0 : km > 80 || (mode === 'transit' && routes.length === 0);
    const tickets: TicketOption[] = [];
    if (far && originName && destinationName) {
      const query = { from: originName, to: destinationName, country, date, lang: language };
      const modes: TicketMode[] = km !== null && km > 400 ? ['flight', 'train'] : ['train', 'bus'];
      for (const m of modes) {
        for (const t of ticketOptions({ ...query, mode: m }, templates, 3)) {
          if (!tickets.some((x) => x.url === t.url)) tickets.push(t);
        }
      }
    }

    return json({
      mode,
      routes: withTickets,
      tickets: tickets.slice(0, 4),
      navigation_url: navigationUrl('lat' in origin ? origin : origin.address, 'lat' in destination ? destination : destination.address, mode),
      quota: { plan: quota.plan, remaining: quota.remaining },
    });
  }
});
