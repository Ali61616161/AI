// Gezginler sohbetinde karşı tarafın mesajını kullanıcının diline çevirir (Google Cloud Translation).
//
//   POST { "message_id": 123, "language": "tr" }  veya  { "invite_id": "...", "language": "tr" } (davet notu)
//     → { text: "...", same: boolean }   (same: mesaj zaten bu dilde)
//
// Gizlilik: mesaj yalnızca isteği yapanın görebildiği satırdan (RLS: davetin tarafı, engel yok) okunur; çeviri
// SAKLANMAZ ve günlüklere yazılmaz, yalnızca çeviri servisine gönderilir. Kullanıcı başına günlük karakter bütçesi vardır.
// Sunucu sırrı: GOOGLE_TRANSLATE_API_KEY (yoksa GOOGLE_MAPS_API_KEY).
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { corsHeaders, dbError, error, json } from '../_shared/http.ts';
import { decodeEntities } from '../_shared/plan-translation.ts';
import { translateBatch, TranslateError } from '../_shared/translate.ts';
import { sameLanguage } from '../_shared/translate-texts.ts';

const LANGUAGES = new Set(['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh']);
/** Kullanıcı başına günde en çok bu kadar karakter (≈ 25 uzun mesaj); aşılınca quota_exceeded. */
const DAILY_CHARS = 40_000;

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
  if (!LANGUAGES.has(body?.language)) return error('bad_request', 400, 'a supported language is required');
  const language: string = body.language;

  let text: string | null = null;
  if (Number.isInteger(body?.message_id)) {
    // RLS: yalnızca kabul edilmiş/yürüyen sohbetin tarafı, engellenmemişse okuyabilir.
    const { data, error: dbErr } = await auth.supabase.from('messages').select('body').eq('id', body.message_id).maybeSingle();
    if (dbErr) return dbError('translate-message: message', dbErr);
    text = data?.body ?? null;
  } else if (typeof body?.invite_id === 'string') {
    const { data, error: dbErr } = await auth.supabase.rpc('my_invites');
    if (dbErr) return dbError('translate-message: invite', dbErr);
    text = (data as { id: string; message: string | null }[] | null)?.find((i) => i.id === body.invite_id)?.message ?? null;
  } else {
    return error('bad_request', 400, 'message_id or invite_id is required');
  }
  if (!text || !text.trim()) return error('not_found', 404);
  text = text.slice(0, 2000);

  const { data: ok, error: budgetErr } = await admin.rpc('consume_translate_chars', { p_user: auth.user.id, p_chars: text.length, p_cap: DAILY_CHARS });
  if (budgetErr) return dbError('translate-message: budget', budgetErr);
  if (!ok) return error('quota_exceeded', 429);

  try {
    const [r] = await translateBatch({ apiKey, texts: [text], target: language, apiBase: Deno.env.get('GOOGLE_TRANSLATE_API_BASE') || undefined });
    const same = sameLanguage(r.detectedSource, language);
    return json({ text: same ? text : decodeEntities(r.text), same });
  } catch (e) {
    console.error('translate-message failed', e instanceof TranslateError ? e.message.replace(/\s+/g, ' ').slice(0, 120) : 'error');
    return error('upstream_failed', 502);
  }
});
