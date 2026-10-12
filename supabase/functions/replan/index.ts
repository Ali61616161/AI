// "Planı Değiştir": anlık durumlara göre günün kalanını yeniden planlar veya
// seyahatin tarihleri değişince planı yeni tarihlere uyarlar.
//
// Anlık durum:
//   POST { "mode": "crisis", "message": "Yağmur başladı...", "trip_id"?: uuid,
//          "location"?: { "lat", "lng" }, "timezone"?: "Europe/Rome" }
//   → { reply, suggestions[], plan_version_id, previous_version_id, date }
//   Seyahat yoksa veya bugün planı yoksa sadece cevap ve öneriler döner.
//
// Tarih değişikliği:
//   POST { "mode": "dates", "trip_id": uuid, "new_start": "YYYY-MM-DD", "new_end": "YYYY-MM-DD" }
//   → { plan_version_id, previous_version_id, analysis, removed[] }
//
// Gerekli sunucu sırları: GEMINI_API_KEY, isteğe bağlı GEMINI_MODEL.
// İsteğe bağlı: GOOGLE_MAPS_API_KEY (anlık hava ve mekan doğrulama), AFFILIATE_*.
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { destinationCoords, enrichDays, googleConfig } from '../_shared/enrich.ts';
import type { Place } from '../_shared/places.ts';
import { fetchCurrent, weatherForPrompt } from '../_shared/weather.ts';
import { isValidTimeZone, utcToLocal } from '../_shared/documents.ts';
import { DEFAULT_GEMINI_MODEL, GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import {
  buildItineraryPrompt,
  datesBetween,
  fixedItemsByDate,
  ITINERARY_RESPONSE_SCHEMA,
  normalizeItinerary,
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
} from '../_shared/replan.ts';
import { loadProfile, loadTrip, type LoadedTrip } from '../_shared/trip-context.ts';

const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
const FREE_MAX_DAYS = 3;
const MAX_DAYS = 30;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const toStored = (days: PayloadDay[]): StoredDay[] => days.map((d) => ({ ...d, plan_items: d.items }));

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
  return error('bad_request', 400, 'mode must be crisis or dates');

  // -------------------------------------------------------------------------
  async function crisis(
    // deno-lint-ignore no-explicit-any
    input: any,
    trip: LoadedTrip | null,
    profile: { language: string; currency: string },
  ) {
    const message = typeof input.message === 'string' ? input.message.trim().slice(0, 500) : '';
    if (!message) return error('bad_request', 400, 'message is required');
    const location =
      input.location && Number.isFinite(input.location.lat) && Number.isFinite(input.location.lng)
        ? { lat: Number(input.location.lat), lng: Number(input.location.lng) }
        : null;

    const quota = await consumeQuota(supabase, 'replan', trip?.id ?? null);
    if (!quota.allowed) return error('quota_exceeded', 402);

    const nowIso = new Date().toISOString();
    // Seyahat varsa saat dilimi rezervasyonlardan, yoksa telefondan gelir.
    const clientTz = typeof input.timezone === 'string' && isValidTimeZone(input.timezone) ? input.timezone : 'UTC';
    const guessDate = utcToLocal(nowIso, clientTz).slice(0, 10);
    const tz = trip ? timezonesByDate([guessDate], trip.reservations)[guessDate] : clientTz;
    const timezone = tz === 'UTC' ? clientTz : tz;
    const localNow = utcToLocal(nowIso, timezone);
    const today = localNow.slice(0, 10);
    const day = trip?.activePlan?.days.find((d) => d.date === today) ?? null;

    const later = (day?.plan_items ?? []).filter((i) => i.starts_at && i.starts_at >= nowIso);
    const google = googleConfig();
    const nearByCity = trip ? await destinationCoords(supabase, trip.destinations, profile.language) : {};
    const city = day?.city ?? trip?.ctx.destinations[0]?.city ?? null;
    const here = location ?? (city ? nearByCity[city.toLowerCase()] : null) ?? null;
    let weather: string | null = null;
    if (google.apiKey && here) {
      weather = await fetchCurrent({ ...here, language: profile.language, apiKey: google.apiKey, apiBase: google.weatherBase })
        .then(weatherForPrompt)
        .catch((e) => {
          console.warn('replan crisis: weather failed', e instanceof Error ? e.message : String(e));
          return null;
        });
    }
    const localTime = (iso: string, itemTz: string | null) => utcToLocal(iso, itemTz ?? timezone).slice(11);

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
      if (saveError) return error('bad_request', 400, saveError.message);
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
  // deno-lint-ignore no-explicit-any
  async function dates(input: any, trip: LoadedTrip | null) {
    if (!trip) return error('bad_request', 400, 'trip_id is required');
    const newStart = String(input.new_start ?? '');
    const newEnd = String(input.new_end ?? '');
    if (!DATE.test(newStart) || !DATE.test(newEnd) || newEnd < newStart) return error('bad_request', 400, 'invalid dates');
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
      if (applyError) return error('bad_request', 400, applyError.message);
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
            oldDays.flatMap((d) => d.plan_items.map((i) => i.title)).join(', ')];
      let raw: unknown;
      try {
        raw = await generateJson({
          apiBase: Deno.env.get('GEMINI_API_BASE'),
          apiKey: apiKey!,
          model,
          prompt: buildItineraryPrompt({ ...trip.ctx, start_date: newStart, end_date: newEnd }, toPlan, fixed, timezones, extra),
          responseSchema: ITINERARY_RESPONSE_SCHEMA,
          timeoutMs: 120_000,
        });
      } catch (e) {
        console.error('replan dates: AI failed', e instanceof GeminiError ? e.message : String(e));
        return error('ai_failed', 502);
      }
      const normalized = normalizeItinerary(raw, { dates: toPlan, fixed, timezones, currency: trip.ctx.currency });
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
    if (applyError) return error('bad_request', 400, applyError.message);

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

