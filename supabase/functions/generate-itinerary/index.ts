// Seyahat için AI ile gün gün, saatlik rota üretir ve yeni plan sürümü olarak kaydeder.
//
// İstek:  POST { "trip_id": "<uuid>" }   (Authorization: Bearer <kullanıcı JWT>)
// Yanıt:  { "plan_version_id", "days_planned", "days_total", "truncated" }
//
// Ücretsiz planda sadece ilk FREE_MAX_DAYS gün planlanır (truncated: true).
// Gerekli sunucu sırları: GEMINI_API_KEY, isteğe bağlı GEMINI_MODEL.
import { createClient } from 'npm:@supabase/supabase-js@2';

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
  type TripContext,
  type TripReservation,
} from '../_shared/itinerary.ts';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const FREE_MAX_DAYS = 3;
const MAX_DAYS = 30;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return error('not_configured', 503, 'GEMINI_API_KEY is not set');

  const authorization = req.headers.get('Authorization');
  if (!authorization) return error('unauthorized', 401);

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return error('unauthorized', 401);

  let tripId: unknown;
  try {
    tripId = (await req.json())?.trip_id;
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  if (typeof tripId !== 'string') return error('bad_request', 400, 'trip_id is required');

  const { data: trip } = await supabase
    .from('trips')
    .select(
      'id, start_date, end_date, companion_type, budget_tier, interests, adults, children, budget_currency, ' +
        'trip_destinations(city, country_code, arrive_on, depart_on, position), ' +
        'reservations(id, type, title, starts_at, ends_at, start_timezone, end_timezone, origin_name, destination_name, address, is_cancelled)',
    )
    .eq('id', tripId)
    .maybeSingle();
  if (!trip) return error('not_found', 404);
  // deno-lint-ignore no-explicit-any
  const t = trip as any;
  if (!t.start_date || !t.end_date) return error('bad_request', 400, 'trip has no dates');

  const { data: canEdit } = await supabase.rpc('can_edit_trip', { p_trip_id: tripId });
  if (!canEdit) return error('not_found', 404);

  const { data: quota, error: quotaError } = await supabase
    .rpc('consume_quota', { p_feature: 'itinerary_generation', p_trip_id: tripId })
    .single<{ allowed: boolean; plan: string; remaining: number | null }>();
  if (quotaError) return error('bad_request', 400, quotaError.message);
  if (!quota.allowed) return error('quota_exceeded', 402);

  const { data: profile } = await supabase
    .from('profiles')
    .select('preferred_language, home_currency')
    .eq('id', auth.user.id)
    .single();

  const allDates = datesBetween(t.start_date, t.end_date, MAX_DAYS);
  const dates = quota.plan === 'free' ? allDates.slice(0, FREE_MAX_DAYS) : allDates;

  const reservations: TripReservation[] = (t.reservations ?? []).filter((r: { is_cancelled: boolean }) => !r.is_cancelled);
  const ctx: TripContext = {
    language: profile?.preferred_language ?? 'en',
    start_date: t.start_date,
    end_date: t.end_date,
    companion: t.companion_type,
    budget: t.budget_tier,
    interests: t.interests ?? [],
    adults: t.adults,
    children: t.children,
    currency: t.budget_currency ?? profile?.home_currency ?? 'EUR',
    destinations: [...(t.trip_destinations ?? [])].sort((a, b) => a.position - b.position),
    reservations,
  };
  const timezones = timezonesByDate(dates, reservations);
  const fixed = fixedItemsByDate(dates, reservations);

  let raw: unknown;
  try {
    raw = await generateJson({
      apiKey,
      model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL,
      prompt: buildItineraryPrompt(ctx, dates, fixed, timezones),
      responseSchema: ITINERARY_RESPONSE_SCHEMA,
      timeoutMs: 120_000,
    });
  } catch (e) {
    const message = e instanceof GeminiError ? e.message : String(e);
    console.error('generate-itinerary: AI failed', message);
    return error('ai_failed', 502, message);
  }

  const { summary, days } = normalizeItinerary(raw, { dates, fixed, timezones, currency: ctx.currency });
  const { data: planVersionId, error: saveError } = await supabase.rpc('save_plan_version', {
    p_trip_id: tripId,
    p_reason: 'initial',
    p_days: toPlanPayload(days),
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
