import { assertEquals } from 'jsr:@std/assert@1';

import { tripReminderDates } from './trip-reminder-logic.ts';

Deno.test('tripReminderDates: bir gün önce 18:00 ve başlangıç günü 08:00, geçmiş ve iptaller atlanır', () => {
  const now = new Date(2026, 9, 20, 12, 0).getTime();
  const r = tripReminderDates(
    [
      { id: 'a', start_date: '2026-10-25', city: 'Roma' },
      { id: 'b', start_date: '2026-10-21', city: 'Paris' }, // bir gün önce = bugün 18:00 (gelecekte)
      { id: 'c', start_date: '2026-10-20', city: 'Berlin' }, // bugün başladı: 08:00 geçti
      { id: 'd', start_date: '2026-11-01', city: 'Oslo', status: 'cancelled' },
      { id: 'e', start_date: null, city: null },
    ],
    now,
  );
  assertEquals(r.map((x) => `${x.tripId}:${x.kind}`), ['b:day_before', 'b:start_day', 'a:day_before', 'a:start_day']);
  assertEquals([r[0].date.getHours(), r[1].date.getHours()], [18, 8]);
  assertEquals(tripReminderDates([{ id: 'a', start_date: '2026-10-25', city: 'Roma' }], now, 1).length, 1);
});
