import { assertEquals } from 'jsr:@std/assert@1';

import { amazonStore, SHOPPABLE_KEYS, shopUrl } from './links.ts';

Deno.test('amazonStore: yaşanan ülke, yoksa dilin mağazası, yoksa ABD', () => {
  assertEquals(amazonStore('TR', 'en'), 'TR');
  assertEquals(amazonStore('de', 'tr'), 'DE');
  assertEquals(amazonStore('RU', 'ru'), 'US'); // Rusya'da Amazon yok
  assertEquals(amazonStore(null, 'tr'), 'TR');
  assertEquals(amazonStore(undefined, 'xx'), 'US');
});

Deno.test('shopUrl: arama sorgusu kodlanır, kimlik varsa eklenir', () => {
  assertEquals(shopUrl('Seyahat adaptörü', { homeCountry: 'TR', language: 'tr' }), 'https://www.amazon.com.tr/s?k=Seyahat%20adapt%C3%B6r%C3%BC');
  assertEquals(shopUrl('power bank', { homeCountry: 'DE', language: 'en', tags: { DE: 'yola0d-21', TR: 'yola-21' } }), 'https://www.amazon.de/s?k=power%20bank&tag=yola0d-21');
  // başka mağazanın kimliği kullanılmaz
  assertEquals(shopUrl('hat', { homeCountry: 'FR', language: 'fr', tags: { DE: 'x-21' } }), 'https://www.amazon.fr/s?k=hat');
});

Deno.test('SHOPPABLE_KEYS: belgeler satın alınamaz, adaptör alınır', () => {
  assertEquals(SHOPPABLE_KEYS.has('plugAdapter'), true);
  assertEquals(SHOPPABLE_KEYS.has('passport'), false);
});
