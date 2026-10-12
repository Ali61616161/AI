import { assertEquals } from 'jsr:@std/assert@1';

import { CONTINENT_OF, summarizeVisited, WORLD_COUNT } from './continents.ts';
import { ALL_DESTINATIONS } from './visa-access.ts';

Deno.test('her ülke tam bir kıtada', () => {
  assertEquals(WORLD_COUNT, ALL_DESTINATIONS.length);
  for (const c of ALL_DESTINATIONS) assertEquals(typeof CONTINENT_OF[c], 'string', `kıtası yok: ${c}`);
});

Deno.test('özet: yüzdeler ve kıta sayısı, bilinmeyen kod sayılmaz', () => {
  const s = summarizeVisited(['TR', 'DE', 'JP', 'XX', 'DE']);
  assertEquals(s.countries, 3);
  assertEquals(s.continents, 2);
  assertEquals(s.percent, Math.round((1000 * 3) / WORLD_COUNT) / 10);
  assertEquals(s.byContinent.find((b) => b.continent === 'asia')!.visited, 1);
});
