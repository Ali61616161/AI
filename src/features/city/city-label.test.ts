import { assertEquals } from 'jsr:@std/assert@1';

import { cityLabel, hasRegion } from './city-label.ts';

Deno.test('il önce, ilçe sonra', () => {
  assertEquals(cityLabel({ city: 'Kadıköy', region: 'İstanbul' }), 'İstanbul, Kadıköy');
  assertEquals(cityLabel({ subregion: 'Beşiktaş', region: 'İstanbul' }), 'İstanbul, Beşiktaş');
});

Deno.test('aynı ad tekrarlanmaz, eksikler atlanır', () => {
  assertEquals(cityLabel({ city: 'Ankara', region: 'Ankara' }), 'Ankara');
  assertEquals(cityLabel({ city: 'Zürich' }), 'Zürich');
  assertEquals(cityLabel({}), null);
  assertEquals(cityLabel(null), null);
});

Deno.test('hasRegion', () => {
  assertEquals(hasRegion('İstanbul, Kadıköy'), true);
  assertEquals(hasRegion('Kadıköy'), false);
  assertEquals(hasRegion(null), false);
});
