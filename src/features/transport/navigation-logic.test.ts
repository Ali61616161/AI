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

Deno.test('gezinme: en yakın nokta, güncel adım, manevra simgesi', async () => {
  const { nearestIndex, currentStepIndex, turnIcon } = await import('./navigation-logic.ts');
  const path = [{ lat: 41.0, lng: 28.6 }, { lat: 41.001, lng: 28.6 }, { lat: 41.002, lng: 28.6 }];
  assertEquals(nearestIndex({ lat: 41.0011, lng: 28.6 }, path), 1);
  assertEquals(nearestIndex(null, path), 0);
  assertEquals(nearestIndex({ lat: 1, lng: 1 }, []), 0);
  const steps = [[path[0], path[1]], [path[1], path[2]]];
  assertEquals(currentStepIndex({ lat: 41.0019, lng: 28.6 }, steps, 0), 1);
  assertEquals(currentStepIndex({ lat: 41.0, lng: 28.6 }, steps, 5), 0);
  assertEquals(currentStepIndex(null, steps, 3), 3);
  assertEquals(currentStepIndex({ lat: 41, lng: 28.6 }, [], 2), 2);
  assertEquals([turnIcon('TURN_LEFT'), turnIcon('TURN_SHARP_RIGHT'), turnIcon('UTURN_LEFT'), turnIcon('STRAIGHT'), turnIcon(null)], ['left', 'right', 'uturn', 'straight', 'straight']);
});

Deno.test('rotadan sapma: doğru parçasına dik mesafe', async () => {
  const { distanceToPathM, REROUTE_M } = await import('./navigation-logic.ts');
  const path = [{ lat: 41.0, lng: 28.6 }, { lat: 41.01, lng: 28.6 }]; // ~1.1 km kuzey-güney doğru
  const onRoute = distanceToPathM({ lat: 41.005, lng: 28.6 }, path)!;
  const aside = distanceToPathM({ lat: 41.005, lng: 28.601 }, path)!; // ~84 m doğuda
  assertEquals(onRoute < 2, true);
  assertEquals(aside > 70 && aside < 100, true);
  assertEquals(aside > REROUTE_M, true);
  assertEquals(distanceToPathM(null, path), null);
  assertEquals(distanceToPathM({ lat: 41, lng: 28.6 }, []), null);
});
