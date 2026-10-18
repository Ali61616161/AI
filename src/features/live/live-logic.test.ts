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
