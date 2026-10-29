import { assertEquals } from 'jsr:@std/assert@1';

import { clampIsoDate, formatClock, formatIsoDate, parseClock, parseIsoDate } from './date-input.ts';

Deno.test('parseIsoDate/formatIsoDate: gidiş-dönüş ve geçersiz tarih', () => {
  assertEquals(formatIsoDate(parseIsoDate('2026-11-12')!), '2026-11-12');
  assertEquals(parseIsoDate('2026-02-30'), null);
  assertEquals(parseIsoDate('12/11/2026'), null);
  assertEquals(parseIsoDate(''), null);
});

Deno.test('parseClock/formatClock', () => {
  assertEquals(formatClock(parseClock('7:05')!), '07:05');
  assertEquals(formatClock(parseClock('23:59')!), '23:59');
  assertEquals(parseClock('24:00'), null);
  assertEquals(parseClock('abc'), null);
});

Deno.test('clampIsoDate', () => {
  assertEquals(clampIsoDate('2026-01-01', '2026-02-01', null), '2026-02-01');
  assertEquals(clampIsoDate('2026-03-01', '2026-02-01', '2026-02-20'), '2026-02-20');
  assertEquals(clampIsoDate('2026-02-10', '2026-02-01', '2026-02-20'), '2026-02-10');
});
