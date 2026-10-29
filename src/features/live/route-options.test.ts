import { assertEquals } from 'jsr:@std/assert@1';

import { clampOption, departureInMin, pickOptions, transferCount, walkMinutes, type OptionRoute } from './route-options.ts';

const now = Date.parse('2026-10-29T01:00:00Z');
const at = (min: number) => new Date(now + min * 60_000).toISOString();
const walk = (m: number) => ({ mode: 'walk' as const, durationMin: m, transit: null });
const ride = (m: number, depart: string | null) => ({ mode: 'transit' as const, durationMin: m, transit: { departTime: depart } });
const route = (d: number, steps: OptionRoute['steps']): OptionRoute => ({ durationMin: d, steps });

Deno.test('departureInMin: ilk biniş saatine kalan dakika; toplu taşıma ya da saat yoksa null', () => {
  assertEquals(departureInMin(route(30, [walk(4), ride(20, at(6))]), now), 6);
  assertEquals(departureInMin(route(30, [walk(4), ride(20, at(-3))]), now), -3);
  assertEquals(departureInMin(route(10, [walk(10)]), now), null);
  assertEquals(departureInMin(route(30, [ride(20, null)]), now), null);
});

Deno.test('transferCount ve walkMinutes', () => {
  const r = route(50, [walk(4), ride(10, at(5)), walk(2), ride(20, at(20)), walk(3)]);
  assertEquals(transferCount(r), 1);
  assertEquals(walkMinutes(r), 9);
  assertEquals(transferCount(route(10, [walk(10)])), 0);
});

Deno.test('pickOptions: kaçmış seçenekler sona, en çok 3', () => {
  const missed = route(25, [ride(20, at(-5))]);
  const a = route(30, [ride(20, at(4))]);
  const b = route(35, [ride(25, at(9))]);
  const c = route(40, [walk(40)]);
  assertEquals(pickOptions([missed, a, b, c], now), [a, b, c]);
  assertEquals(pickOptions([missed], now), [missed]);
  assertEquals(pickOptions([a, b, c], now, 2), [a, b]);
});

Deno.test('clampOption', () => {
  assertEquals(clampOption(1, 3), 1);
  assertEquals(clampOption(5, 3), 0);
  assertEquals(clampOption(-1, 3), 0);
  assertEquals(clampOption(null, 3), 0);
});
