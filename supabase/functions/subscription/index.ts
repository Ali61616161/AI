// Satın alma sonrası uygulamanın çağırdığı senkronizasyon. Uygulamaya güvenilmez:
// kullanıcının satın almaları RevenueCat REST API'sinden okunur.
//
//   POST { "action": "sync" }                    → Pro abonelikleri günceller
//   POST { "action": "claim_trip_pass", "trip_id" } → henüz bağlanmamış en yeni Trip
//        Pass satın almasını bu seyahate bağlar
//   → { plan }  (current_plan sonucu; claim'de o seyahat için)
//
// Gerekli sunucu sırları: REVENUECAT_SECRET_KEY, SUPABASE_SERVICE_ROLE_KEY.
import { adminClient } from '../_shared/admin.ts';
import { userClient } from '../_shared/auth.ts';
import { corsHeaders, error, json } from '../_shared/http.ts';
import { COMPLIMENTARY_PRODUCT_ID, fetchSubscriber, PRO_PLANS, productMapFromEnv, rowsFromSubscriber, tripPassKey, tripPassPurchases } from '../_shared/subscriptions.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return error('bad_request', 405, 'POST only');

  const secret = Deno.env.get('REVENUECAT_SECRET_KEY');
  const admin = adminClient();
  if (!secret || !admin) return error('not_configured', 503, 'REVENUECAT_SECRET_KEY is not set');

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

  const products = productMapFromEnv((n) => Deno.env.get(n));
  let subscriber;
  try {
    subscriber = await fetchSubscriber(user.id, secret, { apiBase: Deno.env.get('REVENUECAT_API_BASE') || undefined });
  } catch (e) {
    console.error('subscription: revenuecat failed', e instanceof Error ? e.message : String(e));
    return error('upstream_failed', 502);
  }

  const rows = rowsFromSubscriber(user.id, subscriber, products);
  if (rows.length) {
    const { error: upsertError } = await admin.from('subscriptions').upsert(rows, { onConflict: 'original_transaction_id' });
    if (upsertError) return error('bad_request', 500, upsertError.message);
  }
  // RevenueCat'te artık bu kullanıcıda olmayan Pro abonelikler (ör. başka hesaba
  // geri yüklenmiş) kapatılır.
  const kept = new Set(rows.map((r) => r.plan));
  const stale = PRO_PLANS.filter((p) => !kept.has(p));
  if (stale.length) {
    const { error: expireError } = await admin
      .from('subscriptions')
      .update({ status: 'expired' })
      .eq('user_id', user.id)
      .in('plan', stale)
      .neq('product_id', COMPLIMENTARY_PRODUCT_ID)
      .in('status', ['active', 'in_grace']);
    if (expireError) return error('bad_request', 500, expireError.message);
  }

  let tripId: string | null = null;
  if (body?.action === 'claim_trip_pass') {
    if (typeof body.trip_id !== 'string') return error('bad_request', 400, 'trip_id is required');
    const { data: canEdit } = await supabase.rpc('can_edit_trip', { p_trip_id: body.trip_id });
    if (!canEdit) return error('not_found', 404);
    tripId = body.trip_id;

    const purchases = tripPassPurchases(subscriber, products);
    const { data: claimed } = await admin
      .from('subscriptions')
      .select('original_transaction_id')
      .in('original_transaction_id', purchases.map((p) => tripPassKey(p.transactionId)));
    const used = new Set((claimed ?? []).map((c) => c.original_transaction_id));
    const free = purchases.find((p) => !used.has(tripPassKey(p.transactionId)));
    if (!free) return error('not_found', 404, 'no unclaimed trip pass');
    const { error: insertError } = await admin.from('subscriptions').insert({
      user_id: user.id,
      plan: 'trip_pass',
      status: 'active',
      store: free.store,
      product_id: free.productId,
      original_transaction_id: tripPassKey(free.transactionId),
      trip_id: tripId,
      starts_at: free.purchasedAt,
      expires_at: null,
    });
    if (insertError) return error('bad_request', 500, insertError.message);
  } else if (body?.action !== 'sync') {
    return error('bad_request', 400, 'action must be sync or claim_trip_pass');
  }

  const { data: plan } = await supabase.rpc('current_plan', { p_trip_id: tripId });
  return json({ plan });
});
