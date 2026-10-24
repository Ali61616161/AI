// RevenueCat webhook'u: abonelik olaylarını subscriptions tablosuna yazar.
// RevenueCat panelinde Integrations → Webhooks'a bu fonksiyonun adresi ve
// "Authorization header" olarak REVENUECAT_WEBHOOK_AUTH değeri girilir.
//
// Gerekli sunucu sırları: REVENUECAT_WEBHOOK_AUTH, SUPABASE_SERVICE_ROLE_KEY (Supabase verir).
// JWT doğrulaması kapalı olmalı: supabase/config.toml → [functions.revenuecat-webhook] verify_jwt = false
import { adminClient } from '../_shared/admin.ts';
import { dbError, error, json } from '../_shared/http.ts';
import { PROMO_PRODUCTS_FILTER, PRO_PLANS, productMapFromEnv, rowFromWebhook, transferredFromUsers } from '../_shared/subscriptions.ts';

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');
  const secret = Deno.env.get('REVENUECAT_WEBHOOK_AUTH');
  const admin = adminClient();
  if (!secret || !admin) return error('not_configured', 503);
  const given = req.headers.get('Authorization') ?? '';
  if (!safeEqual(given, secret) && !safeEqual(given, `Bearer ${secret}`)) return error('unauthorized', 401);

  // deno-lint-ignore no-explicit-any
  let body: any;
  try {
    body = await req.json();
  } catch {
    return error('bad_request', 400, 'body must be JSON');
  }
  // Satın alma başka hesaba taşındıysa eski hesapların Pro erişimi kapanır.
  const previousOwners = transferredFromUsers(body?.event);
  if (previousOwners.length) {
    const { error: transferError } = await admin
      .from('subscriptions')
      .update({ status: 'expired' })
      .in('user_id', previousOwners)
      .in('plan', PRO_PLANS)
      .not('product_id', 'in', PROMO_PRODUCTS_FILTER)
      .in('status', ['active', 'in_grace']);
    if (transferError) return dbError('revenuecat-webhook', transferError, 500);
    return json({ ok: true });
  }

  const result = rowFromWebhook(body?.event, productMapFromEnv((n) => Deno.env.get(n)));
  // Tanınmayan olaylar da 200 döner; aksi halde RevenueCat tekrar tekrar gönderir.
  if (!result) return json({ ok: true, ignored: true });

  if (result.tripPassRefund) {
    const { error: updateError } = await admin
      .from('subscriptions')
      .update({ status: 'refunded' })
      .eq('original_transaction_id', result.row.original_transaction_id);
    if (updateError) return dbError('revenuecat-webhook', updateError, 500);
    return json({ ok: true });
  }

  const { error: upsertError } = await admin.from('subscriptions').upsert(result.row, { onConflict: 'original_transaction_id' });
  if (upsertError) {
    return dbError('revenuecat-webhook', upsertError, 500);
  }
  return json({ ok: true });
});
