import { assertEquals } from 'jsr:@std/assert@1';

import { buildPlanOptions, sameInterests } from './plan-options-logic.ts';

const base = { pace: null, diets: [], stepFree: false, interests: ['art', 'food'], profileInterests: ['food', 'art'], notes: '  ' };

Deno.test('buildPlanOptions: hiçbir şey seçilmediyse boş (profil tercihleriyle devam)', () => {
  assertEquals(buildPlanOptions(base), {});
  assertEquals(buildPlanOptions({ ...base, pace: 'balanced' }), {});
});

Deno.test('buildPlanOptions: seçilenler ve not gönderilir, ilgi alanı sadece değiştiyse', () => {
  const o = buildPlanOptions({ ...base, pace: 'relaxed', diets: ['vegan'], stepFree: true, interests: ['art', 'nature'], notes: ' Sea view ' });
  assertEquals(o, { pace: 'relaxed', diets: ['vegan'], step_free: true, interests: ['art', 'nature'], notes: 'Sea view' });
});

Deno.test('sameInterests: sıra önemsiz', () => {
  assertEquals(sameInterests(['a', 'b'], ['b', 'a']), true);
  assertEquals(sameInterests(['a'], ['a', 'b']), false);
});
