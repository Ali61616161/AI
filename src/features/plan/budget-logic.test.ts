import { assertEquals } from 'jsr:@std/assert@1';

import { dayBudget } from './budget-logic.ts';

const items = [
  { title: 'Müze', estimated_cost: 20, cost_currency: 'CHF' },
  { title: 'Akşam yemeği', estimated_cost: 60, cost_currency: 'CHF' },
  { title: 'Park', estimated_cost: 0, cost_currency: 'CHF' },
  { title: 'Fiyatsız', estimated_cost: null, cost_currency: null },
];

Deno.test('günlük bütçe: aşım, yaklaşma ve rahat', () => {
  const over = dayBudget(items, 70, 'CHF', {});
  assertEquals(over.status, 'over');
  assertEquals(over.total, 80);
  assertEquals(over.top[0].title, 'Akşam yemeği');
  assertEquals(dayBudget(items, 90, 'CHF', {}).status, 'near');
  assertEquals(dayBudget(items, 200, 'CHF', {}).status, 'ok');
});

Deno.test('günlük bütçe: kur çevirisi, kuru olmayan kalem atlanır, fiyat yoksa uyarı yok', () => {
  const mixed = [{ title: 'A', estimated_cost: 10, cost_currency: 'EUR' }, { title: 'B', estimated_cost: 50, cost_currency: 'JPY' }];
  const r = dayBudget(mixed, 100, 'TRY', { EUR: 40 });
  assertEquals(r.total, 400);
  assertEquals(r.skipped, 1);
  assertEquals(r.status, 'over');
  assertEquals(dayBudget([], 100, 'EUR', {}).status, 'none');
  assertEquals(dayBudget(items, 0, 'CHF', {}).status, 'none');
});
