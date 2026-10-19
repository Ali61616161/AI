import { assertEquals } from 'jsr:@std/assert@1';

import { tripPhase } from './trip-phase.ts';

Deno.test('seyahat aşaması: 15 gün sınırı, sürüyor, bitti', () => {
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2026-10-19'), 'far');
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2026-12-28'), 'soon');
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2026-12-27'), 'soon', '15 gün kala');
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2026-12-26'), 'far', '16 gün kala');
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2027-01-11'), 'active', 'başlangıç günü');
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2027-01-20'), 'active', 'bitiş günü');
  assertEquals(tripPhase('2027-01-11', '2027-01-20', '2027-01-21'), 'ended');
  assertEquals(tripPhase('2027-01-11', null, '2027-01-12'), 'ended');
  assertEquals(tripPhase(null, null, '2027-01-12'), 'far');
});
