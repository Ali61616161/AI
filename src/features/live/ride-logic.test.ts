import assert from 'node:assert/strict';
import { test } from 'node:test';

import { effectiveSpeed, matchRide, metersToExit, type RideFix, type RideStep } from './ride-logic.ts';

// ~111 m / 0.001° enlem. Doğuya giden 2 km'lik hat (Metro M2 gibi).
const line = Array.from({ length: 21 }, (_, i) => ({ lat: 41.0, lng: 29.0 + i * 0.001 }));
const metro: RideStep = { index: 1, vehicle: 'subway', line: 'M2', headsign: 'Hacıosman', from: 'A', to: 'B', path: line };
const bus: RideStep = { index: 1, vehicle: 'bus', line: '34', headsign: 'Zincirlikuyu', from: 'A', to: 'B', path: Array.from({ length: 21 }, (_, i) => ({ lat: 41.01, lng: 29.0 + i * 0.001 })) };

const fix = (lng: number, at: number, speed: number | null, lat = 41.0): RideFix => ({ lat, lng, speed, at });

test('hız: cihaz hızı yoksa mesafe/süre ile hesaplanır', () => {
  // 0.001° boylam ≈ 84 m (41° enlemde); 10 sn → ~8.4 m/s
  const s = effectiveSpeed([fix(29.0, 0, null), fix(29.001, 10_000, null)]);
  assert.ok(s !== null && s > 7 && s < 10);
  assert.equal(effectiveSpeed([fix(29.0, 0, null)]), null);
  assert.equal(effectiveSpeed([fix(29.0, 0, null), fix(29.001, 500_000, null)]), null);
});

test('hızlı ve hat üstünde: araçta, art arda iki konum aynı adımı gösterince emin', () => {
  const state = matchRide([fix(29.004, 0, 12), fix(29.006, 8_000, 12)], [metro, bus]);
  assert.equal(state.kind, 'riding');
  if (state.kind === 'riding') {
    assert.equal(state.step.line, 'M2');
    assert.equal(state.sure, true);
  }
});

test('hızlı ama hattan uzak: bilinen araç değil (moving)', () => {
  const state = matchRide([fix(29.004, 0, 12, 41.05), fix(29.006, 8_000, 12, 41.05)], [metro, bus]);
  assert.equal(state.kind, 'moving');
});

test('yürüme hızı toplu taşıma değildir; durakta durma bekleme sayılır', () => {
  assert.equal(matchRide([fix(29.0102, 0, 1.4), fix(29.0103, 8_000, 1.4)], [metro]).kind, 'walking');
  const waiting = matchRide([fix(29.0004, 0, 0), fix(29.0004, 8_000, 0.1)], [metro]);
  assert.equal(waiting.kind, 'waiting');
  // hat boyunda durak olmayan yerde durmak bekleme değil
  assert.equal(matchRide([fix(29.01, 0, 0), fix(29.01, 8_000, 0)], [metro]).kind, 'unknown');
});

test('hız araç türüne uymuyorsa o adım elenir (35 m/s tramvay/otobüs olamaz)', () => {
  const tram: RideStep = { ...bus, vehicle: 'tram' };
  assert.equal(matchRide([fix(29.004, 0, 35, 41.01), fix(29.006, 8_000, 35, 41.01)], [tram]).kind, 'moving');
});

test('iniş noktasına kalan mesafe hat boyunca azalır', () => {
  const near = metersToExit({ lat: 41.0, lng: 29.015 }, metro);
  const far = metersToExit({ lat: 41.0, lng: 29.002 }, metro);
  assert.ok(near !== null && far !== null && near < far);
  assert.ok(far > 1400 && far < 1600);
});
