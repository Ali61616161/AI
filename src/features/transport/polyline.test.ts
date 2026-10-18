import { assertEquals } from 'jsr:@std/assert@1';

import { decodePolyline, thin } from './polyline.ts';

Deno.test('decodePolyline: Google dokümanındaki örnek', () => {
  assertEquals(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@'), [
    { lat: 38.5, lng: -120.2 },
    { lat: 40.7, lng: -120.95 },
    { lat: 43.252, lng: -126.453 },
  ]);
});

Deno.test('decodePolyline: boş ve bozuk girdi çökmez', () => {
  assertEquals(decodePolyline(''), []);
  assertEquals(decodePolyline('_p~iF'), []);
});

Deno.test('thin: uzun çizgi seyrelir, ilk ve son nokta kalır', () => {
  const pts = Array.from({ length: 5000 }, (_, i) => ({ lat: i, lng: i }));
  const t = thin(pts, 100);
  assertEquals(t.length, 100);
  assertEquals(t[0], pts[0]);
  assertEquals(t[99], pts[4999]);
  assertEquals(thin(pts.slice(0, 10), 100).length, 10);
});
