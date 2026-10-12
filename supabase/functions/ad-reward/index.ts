// AdMob ödüllü reklam sunucu doğrulaması (SSV) geri çağrısı. Google, kullanıcı reklamı
// sonuna kadar izleyince bu adresi imzalı bir GET isteğiyle çağırır; imza doğruysa
// kullanıcıya o gün için ilgili özellikte +1 hak verilir (günde en fazla 3 ödül).
//
// AdMob panelinde ödüllü reklam biriminin "Sunucu tarafı doğrulama" ayarına bu
// fonksiyonun adresi girilir. Uygulama isteğe kullanıcı kimliğini (user_id) ve
// özelliği (custom_data) ekler.
//
// Gerekli sunucu sırrı: SUPABASE_SERVICE_ROLE_KEY (Supabase verir).
// JWT doğrulaması kapalı olmalı: supabase/config.toml → [functions.ad-reward] verify_jwt = false
import { adminClient } from '../_shared/admin.ts';
import { fetchVerifierKeys, verifySsv, VERIFIER_KEYS_URL, type VerifierKey } from '../_shared/admob-ssv.ts';
import { error, json } from '../_shared/http.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEATURES = new Set(['nearby_search', 'text_translation', 'travel_info', 'weather']);

// Google anahtarları nadiren değişir; bir gün önbellekte tutulur.
let cached: { keys: VerifierKey[]; at: number } | null = null;
async function keys(): Promise<VerifierKey[]> {
  if (cached && Date.now() - cached.at < 24 * 60 * 60_000) return cached.keys;
  const fresh = await fetchVerifierKeys(Deno.env.get('ADMOB_VERIFIER_KEYS_URL') || VERIFIER_KEYS_URL);
  cached = { keys: fresh, at: Date.now() };
  return fresh;
}

Deno.serve(async (req) => {
  if (req.method !== 'GET') return error('bad_request', 405, 'GET only');
  const admin = adminClient();
  if (!admin) return error('not_configured', 503);

  const rawQuery = new URL(req.url).search;
  // Google, birim kaydedilirken imzasız bir doğrulama isteği gönderir; 200 dönülür.
  if (!rawQuery.includes('signature=')) return json({ ok: true });

  let payload;
  try {
    payload = await verifySsv(rawQuery, await keys());
  } catch (e) {
    console.error('ad-reward: keys failed', e instanceof Error ? e.message : String(e));
    return error('upstream_failed', 502);
  }
  if (!payload) return error('unauthorized', 401, 'invalid signature');
  if (!payload.userId || !UUID.test(payload.userId) || !payload.customData || !FEATURES.has(payload.customData)) {
    return json({ ok: true, ignored: true });
  }

  const { data, error: rpcError } = await admin.rpc('grant_ad_reward', {
    p_user: payload.userId,
    p_feature: payload.customData,
    p_transaction_id: payload.transactionId,
  });
  if (rpcError) {
    console.error('ad-reward: grant failed', rpcError.message);
    return error('bad_request', 500, rpcError.message);
  }
  return json({ ok: true, result: data });
});
