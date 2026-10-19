import { assertEquals } from 'jsr:@std/assert@1';

import { defaultFromChoice, formatDistance, isArrived, remainingMeters } from './navigation-logic.ts';

const istanbul = { lat: 41.0, lng: 28.6 };
const zurich = { lat: 47.37, lng: 8.54 };

Deno.test('başlangıç seçimi: yakındaysa konum, uzaktaysa önceki durak', () => {
  assertEquals(defaultFromChoice(istanbul, { lat: 41.01, lng: 28.61 }, true), 'here');
  assertEquals(defaultFromChoice(istanbul, zurich, true), 'prev');
  assertEquals(defaultFromChoice(null, zurich, true), 'prev');
  assertEquals(defaultFromChoice(istanbul, zurich, false), 'here');
});

Deno.test('kalan mesafe ve varış', () => {
  assertEquals(remainingMeters(null, [istanbul]), null);
  assertEquals(remainingMeters(istanbul, []), null);
  assertEquals(isArrived(remainingMeters(istanbul, [{ lat: 41.0001, lng: 28.6001 }])), true);
  assertEquals(isArrived(500), false);
  assertEquals(formatDistance(420), '420 m');
  assertEquals(formatDistance(2400), '2.4 km');
  assertEquals(formatDistance(15_000), '15 km');
});

Deno.test('rotadan uzak: başlangıca 2 km üstü', async () => {
  const { isOffRoute } = await import('./navigation-logic.ts');
  const start = { lat: 41.0, lng: 28.6 };
  assertEquals(isOffRoute({ lat: 41.001, lng: 28.601 }, [start]), false);
  assertEquals(isOffRoute({ lat: 41.1, lng: 28.6 }, [start]), true);
  assertEquals(isOffRoute(null, [start]), false);
  assertEquals(isOffRoute(start, []), false);
});
