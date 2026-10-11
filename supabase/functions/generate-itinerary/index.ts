// Seyahat için AI ile gün gün, saatlik rota üretir ve yeni plan sürümü olarak kaydeder.
//
// İstek:  POST { "trip_id": "<uuid>" }   (Authorization: Bearer <kullanıcı JWT>)
// Yanıt:  { "plan_version_id", "days_planned", "days_total", "truncated" }
//
// Ücretsiz planda sadece ilk FREE_MAX_DAYS gün planlanır (truncated: true).
// Gerekli sunucu sırları: GEMINI_API_KEY, isteğe bağlı GEMINI_MODEL.
// İsteğe bağlı: GOOGLE_MAPS_API_KEY (mekan doğrulama), AFFILIATE_* (bilet bağlantıları).
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { destinationCoords, enrichDays } from '../_shared/enrich.ts';
import { GeminiError, generateJson } from '../_shared/gemini.ts';
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
import { preferenceRule } from '../_shared/report.ts';
import { loadPastInsights, loadProfile, loadTrip } from '../_shared/trip-context.ts';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const FREE_MAX_DAYS = 3;
const MAX_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return error('not_configured', 503, 'GEMINI_API_KEY is not set');

  const auth = await userClient(req);
  if (!auth) return error('unauthorized', 401);
  const { supabase, user } = auth;

  let tripId: unknown;
  try {
    tripId = (await req.json())?.trip_id;
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  if (typeof tripId !== 'string') return error('bad_request', 400, 'trip_id is required');

  const trip = await loadTrip(supabase, tripId, await loadProfile(supabase, user.id));
  if (!trip) return error('not_found', 404);
  if (!trip.startDate || !trip.endDate) return error('bad_request', 400, 'trip has no dates');

  let quota;
  try {
    quota = await consumeQuota(supabase, 'itinerary_generation', tripId);
  } catch (e) {
    return error('bad_request', 400, String(e));
  }
  if (!quota.allowed) return error('quota_exceeded', 402);

  const allDates = datesBetween(trip.startDate, trip.endDate, MAX_DAYS);
  const dates = quota.plan === 'free' ? allDates.slice(0, FREE_MAX_DAYS) : allDates;
  const timezones = timezonesByDate(dates, trip.reservations);
  const fixed = fixedItemsByDate(dates, trip.reservations);

  let raw: unknown;
  try {
    raw = await generateJson({
      apiBase: Deno.env.get('GEMINI_API_BASE'),
      apiKey,
      model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL,
      prompt: buildItineraryPrompt(trip.ctx, dates, fixed, timezones, [preferenceRule(await loadPastInsights(supabase, tripId))].filter((r): r is string => r !== null)),
      responseSchema: ITINERARY_RESPONSE_SCHEMA,
      timeoutMs: 120_000,
    });
  } catch (e) {
    const message = e instanceof GeminiError ? e.message : String(e);
    console.error('generate-itinerary: AI failed', message);
    return error('ai_failed', 502, message);
  }

  const { summary, days } = normalizeItinerary(raw, { dates, fixed, timezones, currency: trip.ctx.currency });
  const nearByCity = await destinationCoords(supabase, trip.destinations, trip.ctx.language);
  const payload = await enrichDays(toPlanPayload(days), { language: trip.ctx.language, nearByCity });
  const { data: planVersionId, error: saveError } = await supabase.rpc('save_plan_version', {
    p_trip_id: tripId,
    p_reason: 'initial',
    p_days: payload,
    p_summary: summary,
  });
  if (saveError) {
    console.error('generate-itinerary: save failed', saveError.message);
    return error('bad_request', 400, saveError.message);
  }

  return json({
    plan_version_id: planVersionId,
    days_planned: dates.length,
    days_total: allDates.length,
    truncated: dates.length < allDates.length,
    quota: { plan: quota.plan, remaining: quota.remaining },
  });
});
