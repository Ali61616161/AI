// Yüklenen bilet/otel belgesini Gemini ile okur ve documents tablosuna yazar.
//
// İstek:  POST { "document_id": "<uuid>" }   (Authorization: Bearer <kullanıcı JWT>)
// Yanıt:  { "document": { id, status, detected_type, parsed_data, confidence } }
//
// Gerekli sunucu sırları: GEMINI_API_KEY (zorunlu), GEMINI_MODEL (isteğe bağlı).
// SUPABASE_URL ve SUPABASE_ANON_KEY Supabase tarafından otomatik sağlanır.
import { encodeBase64 } from 'jsr:@std/encoding@1/base64';
import { createClient } from 'npm:@supabase/supabase-js@2';

import {
  EXTRACTION_PROMPT,
  EXTRACTION_RESPONSE_SCHEMA,
  minConfidence,
  normalizeParsedDocument,
} from '../_shared/documents.ts';
import { DEFAULT_GEMINI_MODEL, GeminiError, generateJson } from '../_shared/gemini.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';

const SUPPORTED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);
const MAX_BYTES = 10 * 1024 * 1024;
const DEFAULT_MODEL = DEFAULT_GEMINI_MODEL;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return error('not_configured', 503, 'GEMINI_API_KEY is not set');

  const authorization = req.headers.get('Authorization');
  if (!authorization) return error('unauthorized', 401);

  // Kullanıcının kendi yetkisiyle çalışan istemci: RLS sayesinde sadece kendi
  // belgesine ve dosyasına erişebilir.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return error('unauthorized', 401);

  let documentId: unknown;
  try {
    documentId = (await req.json())?.document_id;
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  if (typeof documentId !== 'string') return error('bad_request', 400, 'document_id is required');

  const { data: doc } = await supabase
    .from('documents')
    .select('id, storage_path, mime_type, trip_id, status')
    .eq('id', documentId)
    .maybeSingle();
  if (!doc) return error('not_found', 404);
  if (!SUPPORTED_MIME_TYPES.has(doc.mime_type)) return error('unsupported_file', 415);

  const { data: quota, error: quotaError } = await supabase
    .rpc('consume_quota', { p_feature: 'document_scan', p_trip_id: doc.trip_id })
    .single<{ allowed: boolean; plan: string; remaining: number | null }>();
  if (quotaError) return error('bad_request', 400, quotaError.message);
  if (!quota.allowed) return error('quota_exceeded', 402);

  await supabase.from('documents').update({ status: 'processing', error: null }).eq('id', doc.id);

  const fail = async (code: 'ai_failed' | 'file_too_large' | 'not_found', status: number, message: string) => {
    await supabase.from('documents').update({ status: 'failed', error: message.slice(0, 500) }).eq('id', doc.id);
    return error(code, status, message);
  };

  const { data: file, error: downloadError } = await supabase.storage.from('documents').download(doc.storage_path);
  if (downloadError || !file) return fail('not_found', 404, downloadError?.message ?? 'file missing');
  if (file.size > MAX_BYTES) return fail('file_too_large', 413, `file is ${file.size} bytes`);

  let raw: unknown;
  try {
    raw = await generateJson({
      apiBase: Deno.env.get('GEMINI_API_BASE'),
      apiKey,
      model: Deno.env.get('GEMINI_MODEL') ?? DEFAULT_MODEL,
      prompt: EXTRACTION_PROMPT,
      file: { mimeType: doc.mime_type, base64: encodeBase64(new Uint8Array(await file.arrayBuffer())) },
      responseSchema: EXTRACTION_RESPONSE_SCHEMA,
    });
  } catch (e) {
    const message = e instanceof GeminiError ? e.message : String(e);
    console.error('parse-document: AI failed', message);
    return fail('ai_failed', 502, message);
  }

  const parsed = normalizeParsedDocument(raw);
  const update = {
    status: 'parsed' as const,
    detected_type: parsed.items.length ? parsed.document_type : null,
    parsed_data: parsed,
    confidence: { min: parsed.items.length ? Math.min(...parsed.items.map(minConfidence)) : 0 },
    error: parsed.items.length ? null : 'no reservations found',
  };
  const { data: saved, error: saveError } = await supabase
    .from('documents')
    .update(update)
    .eq('id', doc.id)
    .select('id, status, detected_type, parsed_data, confidence')
    .single();
  if (saveError) return error('bad_request', 400, saveError.message);

  return json({ document: saved, quota: { plan: quota.plan, remaining: quota.remaining } });
});
