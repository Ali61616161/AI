// Seyahat sonrası rapor: istatistikler, puanlar ve AI özeti trip_reports'a yazılır;
// seyahat "tamamlandı" olarak işaretlenir. Özetteki beğeni/beğenmeme çıkarımları
// sonraki rotalarda kullanılır (generate-itinerary → preferenceRule).
//
//   POST { "trip_id", "overall_rating"?: 1-5, "route_rating"?: 1-5, "feedback"?: string }
//     → { stats, insights | null, ai_failed: boolean }
//
// Gerekli sunucu sırrı: GEMINI_API_KEY (yoksa sadece istatistikler kaydedilir).
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { LANGUAGE_NAMES } from '../_shared/itinerary.ts';
import { buildReportPrompt, computeTripStats, isPlace, normalizeInsights, REPORT_RESPONSE_SCHEMA, type ReportDay, type ReportInsights } from '../_shared/report.ts';
import { loadProfile, loadTrip } from '../_shared/trip-context.ts';

const rating = (v: unknown) => (Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5 ? (v as number) : null);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

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
  if (typeof body?.trip_id !== 'string') return error('bad_request', 400, 'trip_id is required');

  const profile = await loadProfile(supabase, user.id);
  const trip = await loadTrip(supabase, body.trip_id, profile);
  if (!trip) return error('not_found', 404);
  const today = new Date().toISOString().slice(0, 10);
  if (trip.startDate && trip.startDate > today) return error('bad_request', 400, 'trip has not started');

  const [{ data: expenses }, { data: ratings }] = await Promise.all([
    supabase.from('expenses').select('amount, amount_in_budget_currency, category').eq('trip_id', trip.id),
    supabase.from('place_ratings').select('place_name, rating').eq('trip_id', trip.id).eq('user_id', user.id),
  ]);

  const days: ReportDay[] = (trip.activePlan?.days ?? []).map((d) => ({
    date: d.date,
    city: d.city,
    items: d.plan_items.map((i) => ({
      kind: i.kind,
      title: i.title,
      place_name: i.place_name,
      lat: i.lat ?? null,
      lng: i.lng ?? null,
      status: i.status ?? 'planned',
      is_locked: i.is_locked,
      category: i.category,
    })),
  }));
  const stats = computeTripStats(
    days,
    (expenses ?? []).map((e) => ({ amount: Number(e.amount_in_budget_currency ?? e.amount), category: e.category })),
    (ratings ?? []).map((r) => ({ place_name: r.place_name, rating: r.rating })),
  );

  const overall = rating(body.overall_rating);
  const feedback = typeof body.feedback === 'string' && body.feedback.trim() ? body.feedback.trim().slice(0, 1000) : null;

  let insights: ReportInsights | null = null;
  let aiFailed = false;
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  // AI özeti seyahat başına sınırlı; kota dolduysa sadece istatistikler kaydedilir.
  if (apiKey && (await consumeQuota(supabase, 'trip_report', trip.id)).allowed) {
    try {
      const raw = await generateJson({
        apiBase: Deno.env.get('GEMINI_API_BASE'),
        apiKey,
        model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
        prompt: buildReportPrompt({
          languageName: LANGUAGE_NAMES[profile.language] ?? 'English',
          title: trip.title,
          cities: [...new Set(days.map((d) => d.city).filter((c): c is string => Boolean(c)))],
          stats,
          currency: trip.ctx.currency,
          ratings: ratings ?? [],
          skipped: days.flatMap((d) => d.items.filter((i) => isPlace(i) && i.status === 'skipped').map((i) => i.place_name!)),
          overallRating: overall,
          feedback,
        }),
        responseSchema: REPORT_RESPONSE_SCHEMA,
        timeoutMs: 45_000,
      });
      insights = normalizeInsights(raw);
    } catch (e) {
      aiFailed = true;
      console.error('trip-report: AI failed', e instanceof GeminiError ? e.message : String(e));
    }
  }

  const { error: saveError } = await supabase.from('trip_reports').upsert({
    trip_id: trip.id,
    stats: { ...stats, currency: trip.ctx.currency },
    overall_rating: overall,
    route_rating: rating(body.route_rating),
    feedback,
    ...(insights ? { ai_insights: insights } : {}),
    generated_at: new Date().toISOString(),
  });
  if (saveError) return error('bad_request', 400, saveError.message);

  if (trip.endDate && trip.endDate <= today) {
    await supabase.from('trips').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', trip.id).neq('status', 'completed');
  }

  return json({ stats: { ...stats, currency: trip.ctx.currency }, insights, ai_failed: aiFailed });
});
