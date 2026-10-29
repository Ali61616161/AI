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

Deno.test('akıcı takip: tahmin, yön geçişi, bölme', async () => {
  const m = await import('./navigation-logic.ts');
  const fix = { lat: 41, lng: 28, heading: 0, speed: 10, at: 0 };
  const p = m.predictPosition(fix, 1000);
  assertEquals(Math.round((p.lat - 41) * 111_320), 10);
  assertEquals(m.predictPosition(fix, 60_000).lat > p.lat, true); // en fazla 2.5 sn ilerler
  assertEquals(Math.round((m.predictPosition(fix, 60_000).lat - 41) * 111_320), 25);
  assertEquals(m.predictPosition({ ...fix, speed: 0.1 }, 1000), { lat: 41, lng: 28 });
  assertEquals(m.predictPosition({ ...fix, heading: null }, 1000), { lat: 41, lng: 28 });
  assertEquals(Math.round(m.blendHeading(350, 10, 0.5)), 0);
  assertEquals(Math.round(m.blendHeading(10, 350, 0.5)), 0);
  assertEquals(m.zoomForSpeed(null), 18);
  assertEquals(m.zoomForSpeed(25) < m.zoomForSpeed(5), true);
  const line = [[{ lat: 41, lng: 28 }, { lat: 41.001, lng: 28 }, { lat: 41.002, lng: 28 }]];
  const s = m.splitAtNearest(line, { lat: 41.0015, lng: 28.0001 });
  assertEquals(s.passed[0].length, 3);
  assertEquals(s.rest[0].length, 2);
  assertEquals(Math.round((s.rest[0][0].lat - 41) * 1e4), 15);
  assertEquals(m.splitAtNearest([], { lat: 1, lng: 1 }).rest, []);
});

import { remainingAlongPath } from './navigation-logic.ts';

Deno.test('remainingAlongPath: dolambaçlı rotada kuş uçuşundan uzun, düz rotada eşit, bitişte ~0', () => {
  // L şeklinde rota: önce kuzeye ~1.1 km, sonra doğuya ~1.1 km (kuş uçuşu ~1.6 km).
  const path = [
    { lat: 41.0, lng: 29.0 },
    { lat: 41.01, lng: 29.0 },
    { lat: 41.01, lng: 29.0132 },
  ];
  const start = remainingAlongPath(path[0], path)!;
  assertEquals(start > 2100 && start < 2300, true);
  const mid = remainingAlongPath({ lat: 41.01, lng: 29.0 }, path)!;
  assertEquals(mid > 1000 && mid < 1200, true);
  assertEquals((remainingAlongPath(path[2], path) ?? 99) < 3, true);
  // Düz rota: kuş uçuşuyla aynı.
  const line = [{ lat: 41.0, lng: 29.0 }, { lat: 41.0, lng: 29.02 }];
  const straight = remainingAlongPath(line[0], line)!;
  assertEquals(Math.abs(straight - remainingMeters(line[0], line)!) < 5, true);
  assertEquals(remainingAlongPath(null, path), null);
  assertEquals(remainingAlongPath(path[0], []), null);
});
