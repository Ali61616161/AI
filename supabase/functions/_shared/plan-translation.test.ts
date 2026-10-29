import { assertEquals } from 'jsr:@std/assert@1';

import { applyTranslation, buildTranslation, chunkStrings, collectStrings, decodeEntities, MAX_PLAN_CHARS, sameLanguageShare, type PlanText } from './plan-translation.ts';

const plan: PlanText = {
  summary: 'Roma gezisi',
  day_plans: [
    { id: 'd1', title: 'Gün 1', notes: null, plan_items: [{ id: 'i1', title: 'Kolezyum', description: 'Sabah erken git' }, { id: 'i2', title: 'Kolezyum', description: null }] },
    { id: 'd2', title: 'Gün 2', notes: '  ', plan_items: [{ id: 'i3', title: 'Öğle yemeği', description: 'Sabah erken git' }] },
  ],
};

Deno.test('collectStrings: benzersiz, boşlar atılır, sıra korunur', () => {
  assertEquals(collectStrings(plan), ['Roma gezisi', 'Gün 1', 'Kolezyum', 'Sabah erken git', 'Gün 2', 'Öğle yemeği']);
});

Deno.test('collectStrings: toplam karakter sınırı', () => {
  const big: PlanText = { summary: null, day_plans: [{ id: 'd', title: null, notes: null, plan_items: Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, title: `${i}`.padEnd(1500, 'x'), description: null })) }] };
  const total = collectStrings(big).reduce((n, s) => n + s.length, 0);
  assertEquals(total <= MAX_PLAN_CHARS, true);
});

Deno.test('chunkStrings: metin ve karakter sınırı', () => {
  assertEquals(chunkStrings(['a', 'b', 'c', 'd', 'e'], 2).map((c) => c.length), [2, 2, 1]);
  assertEquals(chunkStrings(['aaaa', 'bbbb', 'cc'], 10, 6), [['aaaa'], ['bbbb', 'cc']]);
  assertEquals(chunkStrings([]), []);
});

Deno.test('buildTranslation ve applyTranslation: çevrilenler değişir, yer adı vb. aynı kalır', () => {
  const tr = buildTranslation(plan, new Map([['Roma gezisi', 'Trip to Rome'], ['Gün 1', 'Day 1'], ['Kolezyum', 'Colosseum'], ['Sabah erken git', 'Go early in the morning']]));
  assertEquals(tr.summary, 'Trip to Rome');
  assertEquals(tr.days, { d1: { title: 'Day 1', notes: undefined } });
  assertEquals(tr.items?.i1, { title: 'Colosseum', description: 'Go early in the morning' });
  assertEquals(tr.items?.i3, { title: undefined, description: 'Go early in the morning' });
  const out = applyTranslation(plan, tr);
  assertEquals(out.summary, 'Trip to Rome');
  assertEquals(out.day_plans[0].title, 'Day 1');
  assertEquals(out.day_plans[0].plan_items[0].title, 'Colosseum');
  assertEquals(out.day_plans[1].title, 'Gün 2'); // çevirisi yok: eski metin
  assertEquals(out.day_plans[1].plan_items[0].title, 'Öğle yemeği');
  assertEquals(out.day_plans[1].plan_items[0].description, 'Go early in the morning');
});

Deno.test('applyTranslation: çeviri yok ya da "aynı dilde" ise plan olduğu gibi döner', () => {
  assertEquals(applyTranslation(plan, null), plan);
  assertEquals(applyTranslation(plan, { same: true }), plan);
  assertEquals(applyTranslation(plan, undefined), plan);
});

Deno.test('decodeEntities ve sameLanguageShare', () => {
  assertEquals(decodeEntities('Don&#39;t &quot;miss&quot; it &amp; go'), `Don't "miss" it & go`);
  assertEquals(sameLanguageShare([{ text: 'aaaa', detected: 'tr' }, { text: 'bb', detected: 'en' }], 'tr'), 4 / 6);
  assertEquals(sameLanguageShare([{ text: 'x', detected: 'zh-CN' }], 'zh'), 1);
  assertEquals(sameLanguageShare([], 'tr'), 1);
});
