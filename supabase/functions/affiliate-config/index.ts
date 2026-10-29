// Ortaklık bağlantı ayarları (eSIM şablonları, Amazon mağaza kimlikleri). Giriş yapmış kullanıcı gerekir; yalnızca
// herkese açık bağlantı şablonları döner (sırlar değil). Ayrıntı: _shared/affiliate-config.ts.
import { userClient } from '../_shared/auth.ts';
import { readAffiliateConfig } from '../_shared/affiliate-config.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  if (!(await userClient(req))) return error('unauthorized', 401);
  return json(readAffiliateConfig((name) => Deno.env.get(name)));
});
