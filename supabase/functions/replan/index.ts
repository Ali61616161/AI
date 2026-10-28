// "Planı Değiştir": anlık durumlara göre günün kalanını yeniden planlar veya
// seyahatin tarihleri değişince planı yeni tarihlere uyarlar.
//
// Anlık durum:
//   POST { "mode": "crisis", "message": "Yağmur başladı...", "trip_id"?: uuid,
//          "location"?: { "lat", "lng" }, "timezone"?: "Europe/Rome" }
//   → { reply, suggestions[], plan_version_id, previous_version_id, date }
//   Seyahat yoksa veya bugün planı yoksa sadece cevap ve öneriler döner.
//
// Seyahat asistanı (soru, ayar değişikliği, herhangi bir günü yeniden planlama):
//   POST { "mode": "assistant", "trip_id": uuid, "message": "...", "location"?, "timezone"? }
//   → { intent, reply, suggestions[], plan_version_id, previous_version_id, date, settings_updated? }
//   crisis modu "date" (YYYY-MM-DD) alırsa o günün tamamını yeniden planlar (geçmiş gün reddedilir).
//
// Tarih değişikliği:
//   POST { "mode": "dates", "trip_id": uuid, "new_start": "YYYY-MM-DD", "new_end": "YYYY-MM-DD" }
//   → { plan_version_id, previous_version_id, analysis, removed[] }
//
// Gerekli sunucu sırları: GEMINI_API_KEY, isteğe bağlı GEMINI_MODEL.
// İsteğe bağlı: GOOGLE_MAPS_API_KEY (anlık hava ve mekan doğrulama), AFFILIATE_*.
import { airportTransferMinutes } from '../_shared/airport.ts';
import { chunkDates } from '../_shared/chunk.ts';
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { destinationCoords, enrichDays, googleConfig } from '../_shared/enrich.ts';
import { openNowRequest, type Place, searchText } from '../_shared/places.ts';
import { fetchCurrent, weatherForPrompt } from '../_shared/weather.ts';
import { isValidTimeZone, localToUtcIso, utcToLocal } from '../_shared/documents.ts';
import { ASSISTANT_RESPONSE_SCHEMA, buildAssistantPrompt, normalizeAssistant, tripSummaryForPrompt } from '../_shared/assistant.ts';
import { DEFAULT_GEMINI_MODEL, GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, dbError, error, json } from '../_shared/http.ts';
import {
  buildItineraryPrompt,
  datesBetween,
  fixedItemsByDate,
  ITINERARY_RESPONSE_SCHEMA,
  normalizeItinerary,
  safeText,
  timezonesByDate,
  toPlanPayload,
} from '../_shared/itinerary.ts';
import {
  analyzeDateChange,
  buildCrisisPrompt,
  CRISIS_RESPONSE_SCHEMA,
  diffPlans,
  normalizeCrisis,
  replaceRestOfDay,
  shortenRules,
  storedDayToPayload,
  type PayloadDay,
  type StoredDay,
  type NearbyCandidate,
} from '../_shared/replan.ts';
import { loadProfile, loadTrip, type LoadedTrip } from '../_shared/trip-context.ts';

const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
const FREE_MAX_DAYS = 3;
const MAX_DAYS = 30;
const DATES_CHUNK_DAYS = 3;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** 2026-02-30 gibi taşan tarihleri de reddeder. */
const isRealDate = (d: string) => {
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === d;
};

const toStored = (days: PayloadDay[]): StoredDay[] => days.map((d) => ({ ...d, plan_items: d.items }));

const NEARBY_CATEGORIES_FOR_CRISIS = ['restaurant', 'cafe', 'museum', 'attraction'] as const;

/** Konumun 1,5 km çevresindeki şu an açık yerler (en yakın önce, en fazla 14). Hata olursa boş liste. */
async function nearbyCandidates(origin: { lat: number; lng: number }, language: string, apiKey: string, apiBase?: string): Promise<NearbyCandidate[]> {
  const lists = await Promise.all(
    NEARBY_CATEGORIES_FOR_CRISIS.map((category) =>
      searchText({ apiKey, apiBase, origin, body: openNowRequest({ ...origin, category, language, radius: 1500, pageSize: 6 }) }).catch((e) => {
        console.warn('replan crisis: nearby search failed', e instanceof Error ? e.message : String(e));
        return [] as Place[];
      }),
    ),
  );
  const seen = new Set<string>();
  return lists
    .flat()
    .filter((p) => p.openNow !== false && p.status !== 'CLOSED_PERMANENTLY' && p.status !== 'CLOSED_TEMPORARILY' && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (a.distanceM ?? 1e9) - (b.distanceM ?? 1e9))
    .slice(0, 14)
    .map((p) => ({ name: p.name, type: p.type, rating: p.rating, distanceM: p.distanceM, address: p.address }));
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return error('not_configured', 503, 'GEMINI_API_KEY is not set');

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

  const profile = await loadProfile(supabase, user.id);
  const tripId = typeof body?.trip_id === 'string' ? body.trip_id : null;
  const trip = tripId ? await loadTrip(supabase, tripId, profile) : null;
  if (tripId && !trip) return error('not_found', 404);
  const model = Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL;

  if (body?.mode === 'crisis') return crisis(body, trip, profile);
  if (body?.mode === 'dates') return dates(body, trip);
  if (body?.mode === 'assistant') return assistant(body, trip, profile);
  return error('bad_request', 400, 'mode must be crisis, dates or assistant');

  // -------------------------------------------------------------------------
  async function crisis(
    // deno-lint-ignore no-explicit-any
    input: any,
    trip: LoadedTrip | null,
    profile: { language: string; currency: string },
  ) {
    const message = typeof input.message === 'string' ? input.message.trim().slice(0, 500) : '';
    if (!message) return error('bad_request', 400, 'message is required');
    const rawLocation =
      input.location && Number.isFinite(input.location.lat) && Number.isFinite(input.location.lng)
        ? { lat: Number(input.location.lat), lng: Number(input.location.lng) }
        : null;

    const realNowIso = new Date().toISOString();
    // Seyahat varsa saat dilimi rezervasyonlardan, yoksa telefondan gelir.
    const clientTz = typeof input.timezone === 'string' && isValidTimeZone(input.timezone) ? input.timezone : 'UTC';
    const guessDate = utcToLocal(realNowIso, clientTz).slice(0, 10);
    const tz = trip ? timezonesByDate([guessDate], trip.reservations)[guessDate] : clientTz;
    let timezone = tz === 'UTC' ? clientTz : tz;
    const realToday = utcToLocal(realNowIso, timezone).slice(0, 10);

    // İsteğe bağlı "date": bugünden sonraki bir günün tamamı yeniden planlanır (sabah 08:00'den başlar).
    const wantedDate = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
    let nowIso = realNowIso;
    let localNow = utcToLocal(nowIso, timezone);
    let today = realToday;
    const plannedDate = wantedDate && wantedDate !== realToday ? wantedDate : null;
    if (plannedDate) {
      if (plannedDate < realToday) return error('bad_request', 400, 'past date');
      const dayTz = trip ? timezonesByDate([plannedDate], trip.reservations)[plannedDate] : clientTz;
      timezone = dayTz === 'UTC' ? clientTz : dayTz;
      localNow = `${plannedDate}T08:00`;
      nowIso = localToUtcIso(localNow, timezone);
      today = plannedDate;
    }
    // Gelecek günde kullanıcının konumu ve şu anki hava o günle ilgisizdir.
    const location = plannedDate ? null : rawLocation;

    const quota = await consumeQuota(supabase, 'replan', trip?.id ?? null);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const day = trip?.activePlan?.days.find((d) => d.date === today) ?? null;

    const later = (day?.plan_items ?? []).filter((i) => i.starts_at && i.starts_at >= nowIso);
    const google = googleConfig();
    const nearByCity = trip ? await destinationCoords(supabase, trip.destinations, profile.language) : {};
    const city = day?.city ?? trip?.ctx.destinations[0]?.city ?? null;
    const here = location ?? (city ? nearByCity[city.toLowerCase()] : null) ?? null;
    let weather: string | null = null;
    if (google.apiKey && here && !plannedDate) {
      weather = await fetchCurrent({ ...here, language: profile.language, apiKey: google.apiKey, apiBase: google.weatherBase })
        .then(weatherForPrompt)
        .catch((e) => {
          console.warn('replan crisis: weather failed', e instanceof Error ? e.message : String(e));
          return null;
        });
    }
    const localTime = (iso: string, itemTz: string | null) => utcToLocal(iso, itemTz ?? timezone).slice(11);
    // Konum varsa çevredeki gerçek, şu an açık yerler aday listesi olarak modele verilir; model
    // yer uydurmaz ve öneriler gerçekten yakın olur (sadece koordinatla yer adı uydurma sorunu).
    const nearby: NearbyCandidate[] = location && google.apiKey ? await nearbyCandidates(location, profile.language, google.apiKey, google.placesBase) : [];

    let raw: unknown;
    try {
      raw = await generateJson({
        apiBase: Deno.env.get('GEMINI_API_BASE'),
        apiKey: apiKey!,
        model,
        prompt: buildCrisisPrompt({
          language: profile.language,
          message,
          localNow,
          timezone,
          location,
          weather,
          city,
          budget: trip?.ctx.budget ?? 'mid',
          companion: trip?.ctx.companion ?? 'solo',
          interests: trip?.ctx.interests ?? [],
          currency: trip?.ctx.currency ?? profile.currency,
          remaining: later.filter((i) => !i.is_locked).map((i) => ({ time: localTime(i.starts_at!, i.timezone), title: i.title, place: i.place_name })),
          fixedLater: later.filter((i) => i.is_locked).map((i) => ({ time: localTime(i.starts_at!, i.timezone), title: i.title })),
          nearby,
          plannedDate,
        }),
        responseSchema: CRISIS_RESPONSE_SCHEMA,
        timeoutMs: 60_000,
      });
    } catch (e) {
      console.error('replan crisis: AI failed', e instanceof GeminiError ? e.message : String(e));
      return error('ai_failed', 502);
    }

    const result = normalizeCrisis(raw, { nowTime: localNow.slice(11), currency: trip?.ctx.currency ?? profile.currency });
    let planVersionId: string | null = null;
    const previousVersionId = trip?.activePlan?.id ?? null;
    // Öneriler ve yeni plan aynı mekanları içerir; Google'a her mekan bir kez sorulur.
    const cache = new Map<string, Place | null>();
    const enrichOptions = { language: profile.language, near: here, nearByCity, cache };
    const [suggestions] = await enrichDays(
      [{ city, items: result.items.map((i) => ({ ...i, affiliate_partner: i.booking_partner })) }],
      enrichOptions,
    );

    if (result.changePlan && trip?.activePlan && day) {
      const payload = await enrichDays(
        trip.activePlan.days.map((d) => (d.date === today ? replaceRestOfDay(d, nowIso, result.items, timezone) : storedDayToPayload(d))),
        enrichOptions,
      );
      const { data, error: saveError } = await supabase.rpc('save_plan_version', {
        p_trip_id: trip.id,
        p_reason: 'crisis',
        p_days: payload,
        p_summary: result.reply,
        p_user_prompt: message,
      });
      if (saveError) return dbError('replan', saveError, 400);
      planVersionId = data;
    }

    return json({
      reply: result.reply,
      suggestions: suggestions.items,
      weather,
      plan_version_id: planVersionId,
      previous_version_id: planVersionId ? previousVersionId : null,
      date: today,
      quota: { plan: quota.plan, remaining: quota.remaining },
    });
  }

  // -------------------------------------------------------------------------
  // Seyahat asistanı: niyet (soru / gün planı / ayar / diğer) çıkarılır ve uygun işe yönlendirilir.
  async function assistant(
    // deno-lint-ignore no-explicit-any
    input: any,
    trip: LoadedTrip | null,
    profile: { language: string; currency: string },
  ) {
    if (!trip) return error('bad_request', 400, 'trip_id is required');
    const message = typeof input.message === 'string' ? input.message.trim().slice(0, 500) : '';
    if (!message) return error('bad_request', 400, 'message is required');

    const quota = await consumeQuota(supabase, 'trip_chat', trip.id);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const clientTz = typeof input.timezone === 'string' && isValidTimeZone(input.timezone) ? input.timezone : 'UTC';
    const today = utcToLocal(new Date().toISOString(), clientTz).slice(0, 10);
    const planDates = (trip.activePlan?.days ?? []).map((d) => d.date).filter((d) => d >= today);

    let raw: unknown;
    try {
      raw = await generateJson({
        apiBase: Deno.env.get('GEMINI_API_BASE'),
        apiKey: apiKey!,
        model,
        prompt: buildAssistantPrompt({ language: profile.language, today, message, summary: tripSummaryForPrompt(trip), planDates }),
        responseSchema: ASSISTANT_RESPONSE_SCHEMA,
        timeoutMs: 45_000,
      });
    } catch (e) {
      console.error('replan assistant: AI failed', e instanceof GeminiError ? e.message : String(e));
      return error('ai_failed', 502);
    }
    const parsed = normalizeAssistant(raw, { planDates, today });
    const plain = { intent: parsed.intent, reply: parsed.reply, suggestions: [], weather: null, plan_version_id: null, previous_version_id: null, date: today, quota: { plan: quota.plan, remaining: quota.remaining } };

    if (parsed.intent === 'replan_day' && parsed.date && parsed.instruction) {
      const res = await crisis({ message: parsed.instruction, date: parsed.date, timezone: clientTz, location: input.location }, trip, profile);
      if (!res.ok) return res;
      return json({ ...(await res.json()), intent: 'replan_day' });
    }

    if (parsed.intent === 'update_settings' && parsed.settings) {
      const { data: canEdit } = await supabase.rpc('can_edit_trip', { p_trip_id: trip.id });
      if (!canEdit) return json({ ...plain, intent: 'other', reply: parsed.reply });
      const { error: updateError } = await supabase.from('trips').update(parsed.settings).eq('id', trip.id);
      if (updateError) return dbError('replan assistant', updateError, 400);
      return json({ ...plain, settings_updated: true });
    }

    return json(plain);
  }

  // -------------------------------------------------------------------------
  // deno-lint-ignore no-explicit-any
  async function dates(input: any, trip: LoadedTrip | null) {
    if (!trip) return error('bad_request', 400, 'trip_id is required');
    const newStart = String(input.new_start ?? '');
    const newEnd = String(input.new_end ?? '');
    if (!DATE.test(newStart) || !DATE.test(newEnd) || newEnd < newStart || !isRealDate(newStart) || !isRealDate(newEnd)) return error('bad_request', 400, 'invalid dates');
    if (datesBetween(newStart, newEnd, MAX_DAYS + 1).length > MAX_DAYS) return error('bad_request', 400, 'trip too long');

    const oldDays = trip.activePlan?.days ?? [];
    const analysis = analyzeDateChange({
      oldStart: trip.startDate ?? newStart,
      oldEnd: trip.endDate ?? newEnd,
      newStart,
      newEnd,
      reservations: trip.reservations,
      planDays: oldDays,
    });

    // Rota yoksa AI gerekmez: sadece tarihler değişir.
    if (!trip.activePlan) {
      const { error: applyError } = await supabase.rpc('apply_trip_dates', { p_trip_id: trip.id, p_start: newStart, p_end: newEnd, p_days: [] });
      if (applyError) return dbError('replan', applyError, 400);
      return json({ plan_version_id: null, previous_version_id: null, analysis, removed: [] });
    }

    const quota = await consumeQuota(supabase, 'replan', trip.id);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const allDates = datesBetween(newStart, newEnd, MAX_DAYS);
    const plannable = quota.plan === 'free' ? allDates.slice(0, FREE_MAX_DAYS) : allDates;
    const shortened = analysis.removedDates.length > 0;
    // Kısaltmada kalan günler korunacak yerlerle yeniden düzenlenir; sadece uzatmada
    // mevcut günler aynen kalır ve yalnızca yeni günler planlanır.
    const toPlan = shortened ? plannable : plannable.filter((d) => analysis.addedDates.includes(d));
    const copied = oldDays.filter((d) => plannable.includes(d.date) && !toPlan.includes(d.date)).map(storedDayToPayload);

    let planned: PayloadDay[] = [];
    let summary: string | null = null;
    if (toPlan.length) {
      const timezones = timezonesByDate(toPlan, trip.reservations);
      const fixed = fixedItemsByDate(toPlan, trip.reservations);
      const extra = shortened
        ? shortenRules(oldDays, toPlan, analysis.removedHighlights)
        : ['The trip got longer. Plan only these new days; the other days are already planned. Avoid repeating places from the existing plan: ' +
            oldDays
              .flatMap((d) => d.plan_items.map((i) => safeText(i.title, 80)))
              .filter(Boolean)
              .slice(0, 150)
              .join(', ')];
      const transfer = trip.ctx.departure_time ? await airportTransferMinutes({ apiKey: googleConfig().apiKey, reservations: trip.reservations, manualAirport: trip.ctx.departure_airport, language: trip.ctx.language }) : null;
      const planCtx = { ...trip.ctx, start_date: newStart, end_date: newEnd, airport_transfer_min: transfer };
      // Uzun planlar 3'er günlük parçalara bölünüp paralel üretilir (tek çağrı dakikalar sürüyordu).
      const parts = chunkDates(toPlan, DATES_CHUNK_DAYS);
      let normalizedParts: ReturnType<typeof normalizeItinerary>[];
      try {
        normalizedParts = await Promise.all(
          parts.map(async (part) => {
            const note = parts.length > 1 ? [...extra, `You are planning only these days: ${part.join(', ')}. The other days of the trip are planned separately, so do not repeat the same famous sights across days.`] : extra;
            const raw = await generateJson({
              apiBase: Deno.env.get('GEMINI_API_BASE'),
              apiKey: apiKey!,
              model,
              prompt: buildItineraryPrompt(planCtx, part, fixed, timezones, note),
              responseSchema: ITINERARY_RESPONSE_SCHEMA,
              timeoutMs: 120_000,
            });
            return normalizeItinerary(raw, { dates: part, fixed, timezones, currency: trip.ctx.currency });
          }),
        );
      } catch (e) {
        console.error('replan dates: AI failed', e instanceof GeminiError ? e.message : String(e));
        return error('ai_failed', 502);
      }
      const normalized = { summary: normalizedParts.find((n) => n.summary)?.summary ?? null, days: normalizedParts.flatMap((n) => n.days) } as ReturnType<typeof normalizeItinerary>;
      summary = normalized.summary;
      const nearByCity = await destinationCoords(supabase, trip.destinations, trip.ctx.language);
      planned = (await enrichDays(toPlanPayload(normalized.days), { language: trip.ctx.language, nearByCity })) as PayloadDay[];
    }

    const newDays = [...copied, ...planned].sort((a, b) => a.date.localeCompare(b.date));
    const { data: planVersionId, error: applyError } = await supabase.rpc('apply_trip_dates', {
      p_trip_id: trip.id,
      p_start: newStart,
      p_end: newEnd,
      p_days: newDays,
      p_summary: summary,
    });
    if (applyError) return dbError('replan', applyError, 400);

    // Kilitli duraklar (rezervasyonlar) silinmez; sadece plandan çıkan öneriler bildirilir.
    const locked = new Set(oldDays.flatMap((d) => d.plan_items.filter((i) => i.is_locked).map((i) => i.title)));
    const removed = diffPlans(oldDays, toStored(newDays)).flatMap((d) =>
      d.removed.filter((title) => !locked.has(title)).map((title) => ({ date: d.date, title })),
    );
    return json({
      plan_version_id: planVersionId,
      previous_version_id: trip.activePlan.id,
      analysis,
      removed,
      quota: { plan: quota.plan, remaining: quota.remaining },
    });
  }
});

