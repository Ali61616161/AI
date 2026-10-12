import { assertEquals } from 'jsr:@std/assert@1';

import { nextWeekendDates } from './dates.ts';

Deno.test('gelecek hafta sonu: hafta içi → Cumartesi, Cuma → yarın, Cumartesi → bugün', () => {
  assertEquals(nextWeekendDates(2, new Date(2026, 9, 12)), { start: '2026-10-17', end: '2026-10-18' });
  assertEquals(nextWeekendDates(1, new Date(2026, 9, 16)), { start: '2026-10-17', end: '2026-10-17' });
  assertEquals(nextWeekendDates(3, new Date(2026, 9, 17)), { start: '2026-10-17', end: '2026-10-19' });
  assertEquals(nextWeekendDates(1, new Date(2026, 9, 18)), { start: '2026-10-24', end: '2026-10-24' });
});
