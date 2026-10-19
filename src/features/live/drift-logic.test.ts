import { assertEquals } from 'jsr:@std/assert@1';

import { freeDayKey, leaveByMs, minutesLate, nextStop, nudgeAt, overdueStop } from './drift-logic.ts';

const at = (hhmm: string) => `2027-01-12T${hhmm}:00Z`;
const ms = (hhmm: string) => Date.parse(at(hhmm));
const stops = [
  { id: 'a', title: 'A', starts_at: at('09:00'), ends_at: null },
  { id: 'b', title: 'B', starts_at: at('12:00'), ends_at: null },
  { id: 'c', title: 'C', starts_at: at('17:40'), ends_at: null },
  { id: 'd', title: 'D', starts_at: null, ends_at: null },
];

Deno.test('gecikmiş durak: 25 dk sonra, işaretlenmemiş, en eski', () => {
  assertEquals(overdueStop(stops, ms('09:20'), {}, false), null);
  assertEquals(overdueStop(stops, ms('09:30'), {}, false)?.id, 'a');
  assertEquals(overdueStop(stops, ms('12:40'), { a: 'done' }, false)?.id, 'b');
  assertEquals(overdueStop(stops, ms('12:40'), { a: 'done', b: 'skipped' }, false), null);
  assertEquals(overdueStop(stops, ms('09:30'), {}, true), null, 'serbest gün: sorulmaz');
  assertEquals(overdueStop(stops, ms('17:00') + 7 * 3_600_000, { a: 'done', b: 'done', c: 'done' }, false), null);
  assertEquals(overdueStop(stops, ms('16:00'), { a: 'done', b: 'done' }, false), null, 'çok eskiyse sorulmaz');
});

Deno.test('sıradaki durak ve geç kalma', () => {
  assertEquals(nextStop(stops, ms('12:30'), {})?.id, 'c');
  assertEquals(nextStop(stops, ms('12:30'), { c: 'skipped' }), null);
  assertEquals(minutesLate(ms('17:00'), 40, at('17:40')), 0);
  assertEquals(minutesLate(ms('17:00'), 55, at('17:40')), 15);
  assertEquals(minutesLate(ms('17:00'), 20, at('17:40')), -20);
});

Deno.test('havalimanına çıkış, serbest gün anahtarı, bildirim zamanı', () => {
  // Kalkış 17:45, yol 40 dk: 17:45 − (180 + 40 + 10) = 13:55
  assertEquals(new Date(leaveByMs(ms('17:45'), 40)).toISOString(), '2027-01-12T13:55:00.000Z');
  assertEquals(freeDayKey('t1', '2027-01-12'), 't1|2027-01-12');
  assertEquals(nudgeAt(at('12:00'), ms('11:00'))?.toISOString(), '2027-01-12T12:25:00.000Z');
  assertEquals(nudgeAt(at('12:00'), ms('13:00')), null);
  assertEquals(nudgeAt(null, ms('13:00')), null);
});
