// Kısa metinleri kullanıcının diline çevirir (Google Cloud Translation): yolculuk raporu, günlük notları gibi
// başka dilde saklanmış içerikler dil değişince yeni dilde görünür. Aynı (metin, dil) bir kez çevrilir ve saklanır.
//
//   POST { "texts": ["..."], "language": "tr" } → { texts: ["..."] }   (sıra korunur; çevrilemeyen metin olduğu gibi döner)
//
// Metinler kullanıcıya özeldir ama önbellek yalnızca metin özetiyle (SHA-256) anahtarlanır; istemci okuyamaz.
// Sunucu sırrı: GOOGLE_TRANSLATE_API_KEY (yoksa GOOGLE_MAPS_API_KEY).
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { decodeEntities } from '../_shared/plan-translation.ts';
import { translateBatch, TranslateError } from '../_shared/translate.ts';
import { textHash, cleanTexts, MAX_TEXTS } from '../_shared/translate-texts.ts';

const LANGUAGES = new Set(['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh']);
const PER_HOUR = 60;
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
  const texts = cleanTexts(body?.texts);
  if (!texts || !LANGUAGES.has(body?.language)) return error('bad_request', 400, `texts (max ${MAX_TEXTS} strings) and a supported language are required`);
  const language: string = body.language;

  const hashes = await Promise.all(texts.map(textHash));
  const unique = [...new Set(hashes)];
  const { data: cached } = await admin.from('text_translations').select('text_hash, translated').eq('language', language).in('text_hash', unique);
  const found = new Map<string, string>((cached ?? []).map((r: { text_hash: string; translated: string }) => [r.text_hash, r.translated]));

  const missing = new Map<string, string>(); // hash → özgün metin
  texts.forEach((t, i) => {
    if (t && !found.has(hashes[i])) missing.set(hashes[i], t);
  });
  if (missing.size > 0) {
    if (!allowed(auth.user.id)) return error('quota_exceeded', 429);
    try {
      const entries = [...missing.entries()];
      const results = await translateBatch({ apiKey, texts: entries.map(([, t]) => t), target: language, apiBase: Deno.env.get('GOOGLE_TRANSLATE_API_BASE') || undefined });
      const rows: { text_hash: string; language: string; translated: string }[] = [];
      entries.forEach(([hash, original], i) => {
        const translated = decodeEntities(results[i].text).trim();
        // Metin zaten hedef dildeyse Google aynısını döndürür; yine de saklanır, böylece tekrar sorulmaz.
        const value = translated || original;
        found.set(hash, value);
        rows.push({ text_hash: hash, language, translated: value });
      });
      const { error: saveErr } = await admin.from('text_translations').upsert(rows);
      if (saveErr) console.error('translate-texts: save', saveErr.message);
    } catch (e) {
      console.error('translate-texts failed', e instanceof TranslateError ? e.message : String(e).slice(0, 200));
      return error('upstream_failed', 502);
    }
  }
  return json({ texts: texts.map((t, i) => (t ? (found.get(hashes[i]) ?? t) : t)) });
});
