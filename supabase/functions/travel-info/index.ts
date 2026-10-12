// Vize ve giriş koşulları (genel bilgi, resmi kaynaktan doğrulanmalı).
//
//   POST { "passport": "TR", "destination": "IT" }
//     → { requirement, maxStayDays, summary, documents[], notes[], officialUrl, quota }
//   Kota: travel_info (ücretsiz 5/gün). Gerekli sunucu sırrı: GEMINI_API_KEY.
import { consumeQuota, userClient } from '../_shared/auth.ts';
import { GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { LANGUAGE_NAMES } from '../_shared/itinerary.ts';
import { buildVisaPrompt, isCountryCode, normalizeVisa, VISA_RESPONSE_SCHEMA } from '../_shared/travel-info.ts';
import { loadProfile } from '../_shared/trip-context.ts';

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
  const passport = String(body?.passport ?? '').toUpperCase();
  const destination = String(body?.destination ?? '').toUpperCase();
  if (!isCountryCode(passport) || !isCountryCode(destination)) return error('bad_request', 400, 'passport and destination country codes are required');

  const quota = await consumeQuota(supabase, 'travel_info', null);
  if (!quota.allowed) return error('quota_exceeded', 402);

  const profile = await loadProfile(supabase, user.id);
  try {
    const raw = await generateJson({
      apiBase: Deno.env.get('GEMINI_API_BASE'),
      apiKey,
      model: Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash',
      prompt: buildVisaPrompt({
        passport,
        destination,
        languageName: LANGUAGE_NAMES[profile.language] ?? 'English',
        purpose: 'tourism',
        today: new Date().toISOString().slice(0, 10),
      }),
      responseSchema: VISA_RESPONSE_SCHEMA,
      timeoutMs: 45_000,
    });
    return json({ ...normalizeVisa(raw), passport, destination, quota: { plan: quota.plan, remaining: quota.remaining } });
  } catch (e) {
    const message = e instanceof GeminiError ? e.message : String(e);
    console.error('travel-info failed', message);
    return error('ai_failed', 502, message.slice(0, 300));
  }
});
