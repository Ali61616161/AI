import { assertEquals } from 'jsr:@std/assert@1';

import { isAllowedNotificationPath, isDealUrl, isGoogleMapsUrl, isHttpsUrl } from './safe-url.ts';

Deno.test('isHttpsUrl: yalnızca https', () => {
  assertEquals(isHttpsUrl('https://example.com/a'), true);
  assertEquals(isHttpsUrl('http://example.com'), false);
  assertEquals(isHttpsUrl('javascript:alert(1)'), false);
  assertEquals(isHttpsUrl('intent://x#Intent;end'), false);
  assertEquals(isHttpsUrl(null), false);
});

Deno.test('isGoogleMapsUrl: yalnızca Google Haritalar', () => {
  assertEquals(isGoogleMapsUrl('https://www.google.com/maps/search/?api=1&query=x'), true);
  assertEquals(isGoogleMapsUrl('https://maps.google.com/?cid=1'), true);
  assertEquals(isGoogleMapsUrl('https://maps.app.goo.gl/abc'), true);
  assertEquals(isGoogleMapsUrl('https://www.google.com.tr/maps/place/x'), true);
  assertEquals(isGoogleMapsUrl('https://evil.example/maps'), false);
  assertEquals(isGoogleMapsUrl('https://google.com.evil.example/maps'), false);
  assertEquals(isGoogleMapsUrl('https://www.google.com/search?q=x'), false);
});

Deno.test('isAllowedNotificationPath: yalnızca seyahat ekranları', () => {
  const id = '6f1c7e7a-2b1e-4c55-9a51-1c2d3e4f5a6b';
  assertEquals(isAllowedNotificationPath(`/trip/${id}`), true);
  assertEquals(isAllowedNotificationPath(`/trip-live?tripId=${id}`), true);
  assertEquals(isAllowedNotificationPath(`/trip-live?tripId=${id}&day=2`), true);
  assertEquals(isAllowedNotificationPath('/price-watch'), true);
  assertEquals(isAllowedNotificationPath('/price-watch?x=1'), false);
  assertEquals(isAllowedNotificationPath('/join?token=abc'), false);
  assertEquals(isAllowedNotificationPath('//evil.example'), false);
  assertEquals(isAllowedNotificationPath('/profile'), false);
});

Deno.test('isDealUrl: yalnızca Aviasales', () => {
  assertEquals(isDealUrl('https://www.aviasales.com/search/IST1312ROM1?marker=1'), true);
  assertEquals(isDealUrl('https://aviasales.com/x'), true);
  assertEquals(isDealUrl('http://www.aviasales.com/x'), false);
  assertEquals(isDealUrl('https://aviasales.com.evil.example/x'), false);
  assertEquals(isDealUrl('https://evilaviasales.com/x'), false);
});
