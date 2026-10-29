// Seyahat planının metinlerini kullanıcının diline çevirir (Google Cloud Translation); dil değişince eski dilde
// üretilmiş rota yeni dilde görünür. Çeviri (plan sürümü, dil) başına bir kez yapılır ve saklanır.
//
//   POST { "trip_id": "...", "language": "tr" } → { translation: PlanTranslation | null }
//
// Yalnızca kullanıcının erişebildiği seyahatin aktif planı çevrilir (RLS). Yer adları ve adresler çevrilmez.
// Sunucu sırrı: GOOGLE_TRANSLATE_API_KEY (yoksa GOOGLE_MAPS_API_KEY).
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { corsHeaders, dbError, error, json } from '../_shared/http.ts';
import { buildTranslation, chunkStrings, collectStrings, decodeEntities, sameLanguageShare, type PlanText, type PlanTranslation } from '../_shared/plan-translation.ts';
import { translateBatch, TranslateError } from '../_shared/translate.ts';

const LANGUAGES = new Set(['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh']);
/** Plan zaten hedef dildeyse (metinlerin bu kadarı hedef dilde algılanırsa) çeviri yapılmaz. */
const SAME_SHARE = 0.8;
/** Kullanıcı başına saatte en çok bu kadar yeni çeviri (aynı plan ve dil için tekrar çağrı önbellekten gelir). */
const PER_HOUR = 30;
const recent = new Map<string, number[]>();
function allowed(userId: string): boolean {
  const now = Date.now();
  const list = (recent.get(userId) ?? []).filter((t) => now - t < 3_600_000);
  if (list.length >= PER_HOUR) return false;
  list.push(now);
  recent.set(userId, list);
  if (recent.size > 5000) recent.clear();
  return true;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  const auth = await userClient(req);
  if (!auth) return error('unauthorized', 401);
  const admin = adminClient();
  const apiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY');
  if (!admin || !apiKey) return error('not_configured', 503);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  if (typeof body?.trip_id !== 'string' || !LANGUAGES.has(body?.language)) return error('bad_request', 400, 'trip_id and a supported language are required');
  const language: string = body.language;

  // RLS: yalnızca üyesi olunan seyahatin planı gelir.
  const { data: plan, error: dbErr } = await auth.supabase
    .from('plan_versions')
    .select('id, summary, day_plans(id, title, notes, plan_items(id, title, description))')
    .eq('trip_id', body.trip_id)
    .eq('is_active', true)
    .maybeSingle();
  if (dbErr) return dbError('translate-plan: plan', dbErr);
  if (!plan) return json({ translation: null });

  const { data: cached } = await admin.from('plan_translations').select('data').eq('plan_version_id', plan.id).eq('language', language).maybeSingle();
  if (cached) return json({ translation: cached.data as PlanTranslation });

  if (!allowed(auth.user.id)) return error('quota_exceeded', 429);
  const text = plan as unknown as PlanText;
  const strings = collectStrings(text);
  let translation: PlanTranslation = { same: true };
  if (strings.length > 0) {
    try {
      const results: { text: string; detected: string | null; original: string }[] = [];
      for (const chunk of chunkStrings(strings)) {
        const part = await translateBatch({ apiKey, texts: chunk, target: language, apiBase: Deno.env.get('GOOGLE_TRANSLATE_API_BASE') || undefined });
        part.forEach((r, i) => results.push({ original: chunk[i], text: decodeEntities(r.text), detected: r.detectedSource }));
      }
      if (sameLanguageShare(results.map((r) => ({ text: r.original, detected: r.detected })), language) < SAME_SHARE) {
        translation = buildTranslation(text, new Map(results.filter((r) => r.text).map((r) => [r.original, r.text])));
      }
    } catch (e) {
      console.error('translate-plan failed', e instanceof TranslateError ? e.message : String(e).slice(0, 200));
      return error('upstream_failed', 502);
    }
  }
  const { error: saveErr } = await admin.from('plan_translations').upsert({ plan_version_id: plan.id, language, data: translation });
  if (saveErr) console.error('translate-plan: save', saveErr.message);
  return json({ translation });
});
