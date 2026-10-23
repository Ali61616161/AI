import { assertEquals } from 'jsr:@std/assert@1';

import { currentStop, dayIndexFor, distanceKm, hopBetween, type LiveStop } from './live-logic.ts';

const at = (h: number, m = 0) => `2026-10-18T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
const stop = (id: string, start: string | null, end: string | null = null): LiveStop => ({ id, lat: 41, lng: 29, starts_at: start, ends_at: end });
const now = (h: number, m = 0) => Date.parse(at(h, m));

Deno.test('distanceKm: İstanbul–Ankara ≈ 350 km', () => {
  const d = distanceKm({ lat: 41.0082, lng: 28.9784 }, { lat: 39.9334, lng: 32.8597 });
  assertEquals(Math.round(d / 10) * 10, 350);
});

Deno.test('hopBetween: yakın durakta yürüme süresi, uzakta null', () => {
  const near = hopBetween({ lat: 41.0, lng: 29.0 }, { lat: 41.005, lng: 29.0 });
  assertEquals(near.km < 1, true);
  assertEquals(typeof near.walkMin, 'number');
  const far = hopBetween({ lat: 41.0, lng: 29.0 }, { lat: 41.1, lng: 29.0 });
  assertEquals(far.walkMin, null);
});

Deno.test('currentStop: süren durak "now", yoksa sıradaki "next", gün bittiyse son "done"', () => {
  const stops = [stop('a', at(9), at(10)), stop('b', at(11), at(12)), stop('c', at(14))];
  assertEquals(currentStop(stops, now(9, 30)), { index: 0, state: 'now' });
  assertEquals(currentStop(stops, now(10, 30)), { index: 1, state: 'next' });
  assertEquals(currentStop(stops, now(11, 59)), { index: 1, state: 'now' });
  // Bitiş saati yoksa 60 dk sürer sayılır.
  assertEquals(currentStop(stops, now(14, 30)), { index: 2, state: 'now' });
  assertEquals(currentStop(stops, now(16)), { index: 2, state: 'done' });
  assertEquals(currentStop(stops, now(7)), { index: 0, state: 'next' });
});

Deno.test('currentStop: saati olmayan duraklar atlanır, hiç saat yoksa null', () => {
  assertEquals(currentStop([stop('a', null), stop('b', at(11))], now(8)), { index: 1, state: 'next' });
  assertEquals(currentStop([stop('a', null)], now(8)), null);
  assertEquals(currentStop([], now(8)), null);
});

Deno.test('dayIndexFor: bugünün sırası, yoksa null', () => {
  assertEquals(dayIndexFor(['2026-10-17', '2026-10-18'], '2026-10-18'), 1);
  assertEquals(dayIndexFor(['2026-10-17'], '2026-10-18'), null);
});

Deno.test('durak durumları ve günün ilerlemesi', async () => {
  const { stopStatuses, dayProgress } = await import('./live-logic.ts');
  const stops = [stop('a', at(9), at(10)), stop('b', at(11), at(12)), stop('c', at(14)), stop('d', null)];
  const st = stopStatuses(stops, now(11, 30), { a: 'done' });
  assertEquals(st, ['done', 'now', 'later', 'later']);
  const later = stopStatuses(stops, now(13), {});
  assertEquals(later, ['past', 'past', 'next', 'later']);
  assertEquals(dayProgress(later).done, 2);
  assertEquals(dayProgress([]).ratio, 0);
});

Deno.test('varış algılama: yakın ve saati uygun durak', async () => {
  const { arrivedStop } = await import('./live-logic.ts');
  const s = { id: 'x', lat: 41.0, lng: 29.0, starts_at: at(14), ends_at: at(15) };
  const near = { lat: 41.0005, lng: 29.0 }; // ~55 m
  assertEquals(arrivedStop([s], near, now(14, 10), {})?.id, 'x');
  assertEquals(arrivedStop([s], near, now(10), {}), null); // çok erken
  assertEquals(arrivedStop([s], near, now(14, 10), { x: 'done' }), null); // zaten işaretli
  assertEquals(arrivedStop([s], { lat: 41.01, lng: 29.0 }, now(14, 10), {}), null); // ~1 km uzak
  assertEquals(arrivedStop([s], null, now(14, 10), {}), null);
});

Deno.test('çıkış zamanı ve sabit rota başlangıcı', async () => {
  const { leaveInMin, stableOrigin } = await import('./live-logic.ts');
  assertEquals(leaveInMin(now(13, 30), 20, at(14)), 10);
  assertEquals(leaveInMin(now(13, 50), 20, at(14)), -10);
  assertEquals(leaveInMin(now(13), null, at(14)), null);
  const a = stableOrigin(null, { lat: 41.00001, lng: 29.00001 })!;
  assertEquals(a, { lat: 41, lng: 29 });
  assertEquals(stableOrigin(a, { lat: 41.001, lng: 29 }), a); // ~110 m: değişmez
  assertEquals(stableOrigin(a, { lat: 41.01, lng: 29 }), { lat: 41.01, lng: 29 }); // ~1.1 km: güncellenir
  assertEquals(stableOrigin(a, null), a);
});
