// RevenueCat → subscriptions tablosu. Abonelik durumu sadece sunucuda yazılır
// (service_role): webhook olayları ve uygulamanın satın alma sonrası istediği
// senkronizasyon RevenueCat REST API'sinden doğrulanır; uygulamaya güvenilmez.
//
// Ürün kimlikleri (ortam değişkeniyle değiştirilebilir):
//   RC_PRODUCT_TRIP_PASS = yola_trip_pass    (tek seferlik, bir seyahat için)
//   RC_PRODUCT_PRO_MONTHLY = yola_pro_monthly
//   RC_PRODUCT_PRO_YEARLY = yola_pro_yearly
// Google Play abonelik kimlikleri "urun:temel-plan" biçiminde gelir; ":" sonrası atılır.

export type Plan = 'trip_pass' | 'pro_monthly' | 'pro_yearly';
export type Status = 'active' | 'in_grace' | 'cancelled' | 'expired' | 'refunded';
export type Store = 'app_store' | 'play_store' | 'stripe' | 'promotional';

export type SubscriptionRow = {
  user_id: string;
  plan: Plan;
  status: Status;
  store: Store;
  product_id: string;
  original_transaction_id: string;
  trip_id?: string | null;
  starts_at?: string;
  expires_at: string | null;
};

export type ProductMap = Record<string, Plan>;

export function productMapFromEnv(get: (name: string) => string | undefined): ProductMap {
  return {
    [get('RC_PRODUCT_TRIP_PASS') ?? 'yola_trip_pass']: 'trip_pass',
    [get('RC_PRODUCT_PRO_MONTHLY') ?? 'yola_pro_monthly']: 'pro_monthly',
    [get('RC_PRODUCT_PRO_YEARLY') ?? 'yola_pro_yearly']: 'pro_yearly',
  };
}

export function planFor(productId: string | null | undefined, products: ProductMap): Plan | null {
  if (!productId) return null;
  return products[productId.split(':')[0]] ?? null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUserId = (v: unknown): v is string => typeof v === 'string' && UUID.test(v);

export function storeOf(value: unknown): Store {
  const v = String(value ?? '').toLowerCase();
  if (v === 'app_store' || v === 'mac_app_store') return 'app_store';
  if (v === 'play_store') return 'play_store';
  if (v === 'stripe' || v === 'rc_billing') return 'stripe';
  return 'promotional';
}

/** Pro aboneliği için kullanıcı ve plan başına tek kayıt. */
export const proKey = (userId: string, plan: Plan) => `rc:${userId}:${plan}`;
/** Trip Pass için satın alma başına kayıt. */
export const tripPassKey = (transactionId: string) => `rc:tp:${transactionId}`;

const iso = (ms: unknown) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : null);

/**
 * Webhook olayını tablo güncellemesine çevirir. Null dönerse olay yok sayılır.
 * Otomatik yenileme kapatılınca (CANCELLATION) erişim süre sonuna kadar devam eder;
 * sadece iade (CUSTOMER_SUPPORT) hemen kapatır.
 */
// deno-lint-ignore no-explicit-any
export function rowFromWebhook(event: any, products: ProductMap, now = Date.now()): { row: SubscriptionRow; tripPassRefund: boolean } | null {
  if (!event || typeof event !== 'object') return null;
  const userId = [event.app_user_id, event.original_app_user_id, ...(Array.isArray(event.aliases) ? event.aliases : [])].find(isUserId);
  const plan = planFor(event.product_id, products);
  if (!userId || !plan) return null;
  const expiresAt = iso(event.expiration_at_ms);
  const expired = expiresAt !== null && Date.parse(expiresAt) <= now;

  let status: Status;
  switch (event.type) {
    case 'INITIAL_PURCHASE':
    case 'RENEWAL':
    case 'UNCANCELLATION':
    case 'SUBSCRIPTION_EXTENDED':
    case 'TEMPORARY_ENTITLEMENT_GRANT':
    case 'NON_RENEWING_PURCHASE':
      status = expired ? 'expired' : 'active';
      break;
    case 'CANCELLATION':
      status = event.cancel_reason === 'CUSTOMER_SUPPORT' ? 'refunded' : expired ? 'expired' : 'active';
      break;
    case 'BILLING_ISSUE':
      status = 'in_grace';
      break;
    case 'EXPIRATION':
      status = 'expired';
      break;
    default:
      return null;
  }

  if (plan === 'trip_pass') {
    // Trip Pass satın alması uygulamanın "claim" isteğiyle seyahate bağlanır;
    // webhook'tan sadece iade işlenir.
    if (status !== 'refunded' || typeof event.transaction_id !== 'string') return null;
    return {
      tripPassRefund: true,
      row: { user_id: userId, plan, status, store: storeOf(event.store), product_id: event.product_id, original_transaction_id: tripPassKey(event.transaction_id), expires_at: null },
    };
  }

  return {
    tripPassRefund: false,
    row: {
      user_id: userId,
      plan,
      status,
      store: storeOf(event.store),
      product_id: event.product_id,
      original_transaction_id: proKey(userId, plan),
      starts_at: iso(event.purchased_at_ms) ?? undefined,
      expires_at: status === 'in_grace' ? (iso(event.grace_period_expiration_at_ms) ?? expiresAt) : expiresAt,
    },
  };
}

/** RevenueCat REST "subscriber" yanıtından Pro abonelik kayıtları. */
// deno-lint-ignore no-explicit-any
export function rowsFromSubscriber(userId: string, subscriber: any, products: ProductMap, now = Date.now()): SubscriptionRow[] {
  const subs = subscriber?.subscriptions && typeof subscriber.subscriptions === 'object' ? subscriber.subscriptions : {};
  const rows: SubscriptionRow[] = [];
  for (const [productId, s] of Object.entries<Record<string, unknown>>(subs)) {
    const plan = planFor(productId, products);
    if (!plan || plan === 'trip_pass') continue;
    const expires = typeof s.expires_date === 'string' ? s.expires_date : null;
    const grace = typeof s.grace_period_expires_date === 'string' ? s.grace_period_expires_date : null;
    let status: Status;
    if (s.refunded_at) status = 'refunded';
    else if (s.billing_issues_detected_at && grace && Date.parse(grace) > now) status = 'in_grace';
    else if (expires && Date.parse(expires) <= now) status = 'expired';
    else status = 'active';
    rows.push({
      user_id: userId,
      plan,
      status,
      store: storeOf(s.store),
      product_id: productId,
      original_transaction_id: proKey(userId, plan),
      starts_at: typeof s.purchase_date === 'string' ? s.purchase_date : undefined,
      expires_at: status === 'in_grace' ? grace : expires,
    });
  }
  return rows;
}

/** Trip Pass satın almaları (en yeni önce). */
// deno-lint-ignore no-explicit-any
export function tripPassPurchases(subscriber: any, products: ProductMap): { transactionId: string; store: Store; productId: string; purchasedAt: string }[] {
  const non = subscriber?.non_subscriptions && typeof subscriber.non_subscriptions === 'object' ? subscriber.non_subscriptions : {};
  const out = [];
  for (const [productId, list] of Object.entries<unknown>(non)) {
    if (planFor(productId, products) !== 'trip_pass' || !Array.isArray(list)) continue;
    for (const p of list) {
      const id = p?.store_transaction_id ?? p?.id;
      if (typeof id === 'string' && typeof p?.purchase_date === 'string') out.push({ transactionId: id, store: storeOf(p.store), productId, purchasedAt: p.purchase_date });
    }
  }
  return out.sort((a, b) => b.purchasedAt.localeCompare(a.purchasedAt));
}

export const REVENUECAT_API_BASE = 'https://api.revenuecat.com';

export async function fetchSubscriber(userId: string, secretKey: string, options: { apiBase?: string; fetchImpl?: typeof fetch } = {}) {
  const res = await (options.fetchImpl ?? fetch)(`${options.apiBase ?? REVENUECAT_API_BASE}/v1/subscribers/${encodeURIComponent(userId)}`, {
    headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`revenuecat http ${res.status}`);
  return (await res.json())?.subscriber ?? {};
}
