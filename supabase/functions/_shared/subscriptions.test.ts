import { assertEquals } from 'jsr:@std/assert@1';

import { planFor, productMapFromEnv, proKey, rowFromWebhook, rowsFromSubscriber, transferredFromUsers, tripPassKey, tripPassPurchases } from './subscriptions.ts';

const P = productMapFromEnv(() => undefined);
const U = '6f1c7e7a-2b1e-4c55-9a51-1c2d3e4f5a6b';
const NOW = Date.parse('2026-10-11T12:00:00Z');
const later = Date.parse('2026-11-11T12:00:00Z');
const ev = (type: string, extra: Record<string, unknown> = {}) => ({ type, app_user_id: U, product_id: 'yola_pro_monthly', store: 'APP_STORE', expiration_at_ms: later, purchased_at_ms: NOW, ...extra });

Deno.test('planFor: Google Play temel plan son eki atılır, bilinmeyen ürün yok sayılır', () => {
  assertEquals(planFor('yola_pro_yearly:annual', P), 'pro_yearly');
  assertEquals(planFor('yola_trip_pass', P), 'trip_pass');
  assertEquals(planFor('other', P), null);
});

Deno.test('rowFromWebhook: satın alma, yenileme kapatma, iade, fatura sorunu, süre sonu', () => {
  const buy = rowFromWebhook(ev('INITIAL_PURCHASE'), P, NOW)!.row;
  assertEquals([buy.plan, buy.status, buy.store, buy.original_transaction_id, buy.expires_at], ['pro_monthly', 'active', 'app_store', proKey(U, 'pro_monthly'), '2026-11-11T12:00:00.000Z']);
  assertEquals(rowFromWebhook(ev('CANCELLATION', { cancel_reason: 'UNSUBSCRIBE' }), P, NOW)!.row.status, 'active', 'süre sonuna kadar erişim sürer');
  assertEquals(rowFromWebhook(ev('CANCELLATION', { cancel_reason: 'CUSTOMER_SUPPORT' }), P, NOW)!.row.status, 'refunded');
  const grace = rowFromWebhook(ev('BILLING_ISSUE', { grace_period_expiration_at_ms: Date.parse('2026-10-20T00:00:00Z') }), P, NOW)!.row;
  assertEquals([grace.status, grace.expires_at], ['in_grace', '2026-10-20T00:00:00.000Z']);
  assertEquals(rowFromWebhook(ev('EXPIRATION'), P, NOW)!.row.status, 'expired');
  assertEquals(rowFromWebhook(ev('RENEWAL', { expiration_at_ms: NOW - 1 }), P, NOW)!.row.status, 'expired');
});

Deno.test('rowFromWebhook: anonim kullanıcı, bilinmeyen ürün ve test olayı yok sayılır; alias ile kullanıcı bulunur', () => {
  assertEquals(rowFromWebhook(ev('INITIAL_PURCHASE', { app_user_id: '$RCAnonymousID:abc' }), P, NOW), null);
  assertEquals(rowFromWebhook(ev('INITIAL_PURCHASE', { app_user_id: '$RCAnonymousID:abc', aliases: ['$RCAnonymousID:abc', U] }), P, NOW)!.row.user_id, U);
  assertEquals(rowFromWebhook(ev('INITIAL_PURCHASE', { product_id: 'x' }), P, NOW), null);
  assertEquals(rowFromWebhook(ev('TEST'), P, NOW), null);
});

Deno.test('rowFromWebhook: Trip Pass sadece iadede işlenir', () => {
  assertEquals(rowFromWebhook(ev('NON_RENEWING_PURCHASE', { product_id: 'yola_trip_pass', transaction_id: 't1' }), P, NOW), null);
  const refund = rowFromWebhook(ev('CANCELLATION', { product_id: 'yola_trip_pass', transaction_id: 't1', cancel_reason: 'CUSTOMER_SUPPORT' }), P, NOW)!;
  assertEquals([refund.tripPassRefund, refund.row.status, refund.row.original_transaction_id], [true, 'refunded', tripPassKey('t1')]);
});

Deno.test('rowsFromSubscriber ve tripPassPurchases: REST yanıtı', () => {
  const subscriber = {
    subscriptions: {
      'yola_pro_yearly:annual': { expires_date: '2027-10-11T12:00:00Z', purchase_date: '2026-10-11T12:00:00Z', store: 'play_store' },
      yola_pro_monthly: { expires_date: '2026-09-01T00:00:00Z', store: 'app_store' },
      other: { expires_date: '2030-01-01T00:00:00Z' },
    },
    non_subscriptions: {
      yola_trip_pass: [
        { id: 'rc1', store_transaction_id: 'GPA.1', purchase_date: '2026-10-01T00:00:00Z', store: 'play_store' },
        { id: 'rc2', purchase_date: '2026-10-10T00:00:00Z', store: 'app_store' },
      ],
    },
  };
  const rows = rowsFromSubscriber(U, subscriber, P, NOW);
  assertEquals(rows.map((r) => [r.plan, r.status, r.store]), [['pro_yearly', 'active', 'play_store'], ['pro_monthly', 'expired', 'app_store']]);
  assertEquals(tripPassPurchases(subscriber, P).map((p) => p.transactionId), ['rc2', 'GPA.1']);
});

Deno.test('transferredFromUsers: TRANSFER olayında eski sahipler', () => {
  const V = '7a2d8f8b-3c2f-4d66-8b62-2d3e4f5a6b7c';
  assertEquals(transferredFromUsers({ type: 'TRANSFER', transferred_from: [U, '$RCAnonymousID:x'], transferred_to: [V] }), [U]);
  assertEquals(transferredFromUsers({ type: 'TRANSFER', transferred_from: [U], transferred_to: [U] }), []);
  assertEquals(transferredFromUsers(ev('RENEWAL')), []);
});
