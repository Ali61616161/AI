import { assert, assertEquals } from 'jsr:@std/assert@1';

import { candidates, categoryFor, DECIDE_GROUPS, pickPlace } from './pick.ts';

const place = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  name: id,
  address: null,
  lat: 41.9,
  lng: 12.5,
  rating: 4.5,
  ratingCount: 100,
  priceLevel: null,
  mapsUrl: null,
  type: null,
  status: 'OPERATIONAL',
  openNow: true,
  distanceM: 500,
  ...extra,
});

Deno.test('categoryFor: grup kendi kategorilerinden, sürpriz hepsinden seçer', () => {
  assertEquals(categoryFor('food', () => 0.99), 'restaurant');
  assertEquals(categoryFor('see', () => 0.5), 'museum');
  const all = Object.values(DECIDE_GROUPS).flat();
  for (const r of [0, 0.3, 0.6, 0.999]) assert(all.includes(categoryFor('surprise', () => r)));
});

Deno.test('candidates: kapalı, gösterilmiş ve düşük puanlı yerler elenir', () => {
  const places = [place('a'), place('b', { openNow: false }), place('c', { status: 'CLOSED_TEMPORARILY' }), place('d', { rating: 3.9 }), place('e', { rating: null })];
  assertEquals(candidates(places).map((p) => p.id), ['a', 'd', 'e']);
  assertEquals(candidates(places, { minRating: 4.2 }).map((p) => p.id), ['a']);
  assertEquals(candidates(places, { exclude: new Set(['a']) }).map((p) => p.id), ['d', 'e']);
});

Deno.test('pickPlace: boşsa null, her uygun yer seçilebilir', () => {
  assertEquals(pickPlace([]), null);
  assertEquals(pickPlace([place('a', { openNow: false })]), null);
  const places = [place('a'), place('b', { rating: 3.6, distanceM: 2400 })];
  assertEquals(pickPlace(places, {}, () => 0)!.id, 'a');
  assertEquals(pickPlace(places, {}, () => 0.9999)!.id, 'b');
});
