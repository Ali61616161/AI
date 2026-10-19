import { assertEquals } from 'jsr:@std/assert@1';

import { readinessItems, readinessProgress } from './readiness.ts';

Deno.test('hazırlık: bilet varsa uçuş saati sorulmaz', () => {
  const none = readinessItems({ hasFlightOrTransport: false, hasHotel: false, hasPlan: false, hasFlightTimes: false, daysUntilStart: 30 });
  assertEquals(readinessProgress(none), { done: 0, total: 4 });
  const ticket = readinessItems({ hasFlightOrTransport: true, hasHotel: false, hasPlan: true, hasFlightTimes: false, daysUntilStart: 30 });
  assertEquals(ticket.map((x) => [x.key, x.done]), [['ticket', true], ['hotel', false], ['plan', true], ['times', true]]);
  assertEquals(readinessProgress(ticket), { done: 3, total: 4 });
  const manualTimes = readinessItems({ hasFlightOrTransport: false, hasHotel: true, hasPlan: true, hasFlightTimes: true, daysUntilStart: 5 });
  assertEquals(manualTimes.find((x) => x.key === 'times')?.done, true);
});
