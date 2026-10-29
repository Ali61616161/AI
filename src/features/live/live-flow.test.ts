import { assertEquals } from 'jsr:@std/assert@1';

import { activeStopIndex, daySummary, flowStatuses, minutesLeft, minutesTo, remainingIds, splitMinutes } from './live-flow.ts';
import type { LiveStop } from './live-logic.ts';

const at = (h: number, m = 0) => `2026-10-18T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`;
const now = (h: number, m = 0) => Date.parse(at(h, m));
const stop = (id: string, start: string | null, end: string | null = null): LiveStop => ({ id, lat: 41, lng: 29, starts_at: start, ends_at: end });
const stops = [stop('a', at(9), at(10)), stop('b', at(11), at(12)), stop('c', at(14), at(15))];

Deno.test('activeStopIndex: işaretlenmemiş, saati geçmemiş ilk durak', () => {
  assertEquals(activeStopIndex(stops, now(8), {}, {}), 0);
  assertEquals(activeStopIndex(stops, now(10, 30), {}, {}), 1);
  // erken bitirilen durak sıradakini odak yapar
  assertEquals(activeStopIndex(stops, now(9, 20), { a: 'done' }, {}), 1);
  assertEquals(activeStopIndex(stops, now(9, 20), { a: 'done', b: 'skipped', c: 'done' }, {}), null);
});

Deno.test('activeStopIndex: hepsinin saati geçtiyse en eski işaretlenmemiş; ara adım önceliklidir', () => {
  assertEquals(activeStopIndex(stops, now(18), {}, {}), 0);
  assertEquals(activeStopIndex(stops, now(8), {}, { c: 'enroute' }), 2);
  assertEquals(activeStopIndex(stops, now(8), {}, { b: 'enroute', c: 'here' }), 2);
  // işaretlenen durağın ara adımı yok sayılır
  assertEquals(activeStopIndex(stops, now(8), { c: 'done' }, { c: 'here' }), 0);
});

Deno.test('activeStopIndex: saatsiz durak saati geçmiş sayılmaz', () => {
  assertEquals(activeStopIndex([stop('x', null), stop('y', at(9))], now(12), {}, {}), 0);
});

Deno.test('flowStatuses: şimdi / sıradaki / sonra / geçti, işaret ve ara adımlar', () => {
  assertEquals(flowStatuses(stops, now(9, 30), {}, {}), ['now', 'later', 'later']);
  assertEquals(flowStatuses(stops, now(10, 30), {}, {}), ['past', 'next', 'later']);
  assertEquals(flowStatuses(stops, now(9, 20), { a: 'done' }, {}), ['done', 'next', 'later']);
  assertEquals(flowStatuses(stops, now(8), { a: 'skipped' }, { b: 'enroute' }), ['skipped', 'enroute', 'later']);
  assertEquals(flowStatuses(stops, now(8), {}, { a: 'here' }), ['here', 'later', 'later']);
});

Deno.test('daySummary ve remainingIds', () => {
  const marks = { a: 'done', b: 'skipped' } as const;
  assertEquals(daySummary(stops, marks), { done: 1, skipped: 1, left: 1, total: 3 });
  assertEquals(remainingIds(stops, marks), ['c']);
  assertEquals(daySummary([], {}), { done: 0, skipped: 0, left: 0, total: 0 });
});

Deno.test('dakika yardımcıları', () => {
  assertEquals(splitMinutes(65), { h: 1, m: 5 });
  assertEquals(splitMinutes(-3), { h: 0, m: 0 });
  assertEquals(minutesTo(at(9), now(8, 30)), 30);
  assertEquals(minutesTo(at(9), now(9, 10)), -10);
  assertEquals(minutesTo(null, now(9)), null);
  assertEquals(minutesLeft(stops[0], now(9, 35)), 25);
  assertEquals(minutesLeft(stop('z', null), now(9)), null);
});
