// Edge Function'lar için ortak HTTP yardımcıları.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'content-type': 'application/json' },
  });
}

/** Uygulamanın tanıdığı hata kodları; arayüz bunlara göre mesaj gösterir. */
export type ErrorCode =
  | 'unauthorized'
  | 'bad_request'
  | 'not_found'
  | 'quota_exceeded'
  | 'unsupported_file'
  | 'file_too_large'
  | 'ai_failed'
  | 'not_configured'
  | 'upstream_failed';

export function error(code: ErrorCode, status: number, message?: string): Response {
  return json({ error: { code, message: message ?? code } }, status);
}
