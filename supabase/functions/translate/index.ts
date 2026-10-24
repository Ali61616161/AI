// Çeviri merkezi.
//
//   POST { "mode": "text", "text", "target", "source"? }
//     → { text, detected_source, quota }                    (kota: text_translation, 1)
//   POST { "mode": "voice", "text", "target", "source", "seconds" }
//     → { text, detected_source, quota }                    (kota: voice_translation, saniye)
//     Konuşma telefonda yazıya çevrilir; sunucuya sadece metin ve süre gelir.
//   POST { "mode": "speak", "text", "target", "voice_lang"?, "gender"? }
//     → { audio: base64 mp3, voice }                        (kota: voice_translation, ~15 karakter = 1 sn)
//     Google'ın doğal (Chirp 3 HD / Neural2) sesleriyle okur; hata olursa uygulama cihaz sesine döner.
//   POST { "mode": "image", "image": base64, "mime_type", "target" }
//     → { kind, source_language, summary, items[], quota }  (kota: menu_scan, 1)
//
// Sunucu sırları: GOOGLE_TRANSLATE_API_KEY (yoksa GOOGLE_MAPS_API_KEY), GEMINI_API_KEY.
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { DEFAULT_GEMINI_MODEL, GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { listTtsVoices, MAX_TTS_CHARS, pickTtsVoice, synthesize } from '../_shared/tts.ts';
import {
  buildImagePrompt,
  IMAGE_RESPONSE_SCHEMA,
  isLanguageCode,
  MAX_TEXT_LENGTH,
  normalizeImageTranslation,
  TranslateError,
  translateText,
} from '../_shared/translate.ts';

const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const auth = await userClient(req);
  if (!auth) return error('unauthorized', 401);
  const { supabase } = auth;

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  if (!isLanguageCode(body?.target)) return error('bad_request', 400, 'target language is required');
  if (body.source != null && !isLanguageCode(body.source)) return error('bad_request', 400, 'invalid source language');

  if (body.mode === 'text' || body.mode === 'voice') {
    const apiKey = Deno.env.get('GOOGLE_TRANSLATE_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return error('not_configured', 503, 'GOOGLE_TRANSLATE_API_KEY is not set');
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return error('bad_request', 400, 'text is required');
    if (text.length > MAX_TEXT_LENGTH) return error('bad_request', 400, 'text too long');

    const voice = body.mode === 'voice';
    // Konuşma süresi saniye olarak sayılır. Uygulamanın bildirdiği süre metin uzunluğuyla da sınanır
    // (~15 karakter/sn): "1 saniye" deyip uzun metin çevirtmek kotayı aşamaz.
    const claimed = Math.min(Math.max(Math.ceil(Number(body.seconds) || 1), 1), 60);
    const seconds = voice ? Math.max(claimed, Math.ceil(text.length / 15)) : 1;
    const quota = await consumeQuota(supabase, voice ? 'voice_translation' : 'text_translation', null, seconds);
    if (!quota.allowed) return json({ error: { code: 'quota_exceeded', message: 'quota_exceeded' }, quota: { plan: quota.plan, remaining: quota.remaining } }, 402);

    try {
      const result = await translateText({
        apiKey,
        apiBase: Deno.env.get('GOOGLE_TRANSLATE_API_BASE') || undefined,
        text,
        target: body.target,
        source: body.source ?? null,
      });
      return json({ text: result.text, detected_source: result.detectedSource, quota: { plan: quota.plan, remaining: quota.remaining } });
    } catch (e) {
      console.error('translate failed', e instanceof TranslateError ? e.message : String(e));
      return error('upstream_failed', 502);
    }
  }

  if (body.mode === 'speak') {
    // Ayrı anahtar verilmediyse çeviri/haritalar anahtarı kullanılır (Cloud Text-to-Speech API açık olmalı).
    const apiKey = Deno.env.get('GOOGLE_TTS_API_KEY') ?? Deno.env.get('GOOGLE_TRANSLATE_API_KEY') ?? Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!apiKey) return error('not_configured', 503);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text) return error('bad_request', 400, 'text is required');
    if (text.length > MAX_TTS_CHARS) return error('bad_request', 400, 'text too long');
    const languageCode = typeof body.voice_lang === 'string' && /^[a-z]{2,3}(-[A-Za-z0-9]{2,4})?$/.test(body.voice_lang) ? body.voice_lang : body.target;
    const gender = body.gender === 'male' ? 'male' : 'female';

    const quota = await consumeQuota(supabase, 'voice_translation', null, Math.max(1, Math.ceil(text.length / 15)));
    if (!quota.allowed) return json({ error: { code: 'quota_exceeded', message: 'quota_exceeded' }, quota: { plan: quota.plan, remaining: quota.remaining } }, 402);
    try {
      const apiBase = Deno.env.get('GOOGLE_TTS_API_BASE') || undefined;
      const voice = pickTtsVoice(await listTtsVoices(apiKey, apiBase), languageCode, gender);
      if (!voice) return error('not_found', 404, 'no voice for language');
      const rate = Math.min(Math.max(Number(body.rate) || 1, 0.5), 1.5);
      const audio = await synthesize({ apiKey, apiBase, text, voice, rate });
      return json({ audio, voice: voice.name });
    } catch (e) {
      console.error('speak failed', e instanceof Error ? e.message : String(e));
      return error('upstream_failed', 502);
    }
  }

  if (body.mode === 'image') {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return error('not_configured', 503, 'GEMINI_API_KEY is not set');
    const mime = String(body.mime_type ?? '');
    const image = typeof body.image === 'string' ? body.image : '';
    if (!IMAGE_TYPES.includes(mime)) return error('unsupported_file', 400);
    if (!image) return error('bad_request', 400, 'image is required');
    if (image.length * 0.75 > MAX_IMAGE_BYTES) return error('file_too_large', 413);

    const quota = await consumeQuota(supabase, 'menu_scan', null);
    if (!quota.allowed) return json({ error: { code: 'quota_exceeded', message: 'quota_exceeded' }, quota: { plan: quota.plan, remaining: quota.remaining } }, 402);

    const languageName = new Intl.DisplayNames(['en'], { type: 'language' }).of(body.target) ?? body.target;
    try {
      const raw = await generateJson({
        apiBase: Deno.env.get('GEMINI_API_BASE'),
        apiKey,
        model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL,
        prompt: buildImagePrompt(languageName),
        file: { mimeType: mime, base64: image },
        responseSchema: IMAGE_RESPONSE_SCHEMA,
        timeoutMs: 60_000,
      });
      const result = normalizeImageTranslation(raw);
      return json({
        kind: result.kind,
        source_language: result.sourceLanguage,
        summary: result.summary,
        items: result.items,
        quota: { plan: quota.plan, remaining: quota.remaining },
      });
    } catch (e) {
      console.error('image translate failed', e instanceof GeminiError ? e.message : String(e));
      return error('ai_failed', 502);
    }
  }

  return error('bad_request', 400, 'mode must be text, voice, speak or image');
});
