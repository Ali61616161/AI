import { assertEquals } from 'jsr:@std/assert@1';

import { parseAmazonTags, readAffiliateConfig, validEsimTemplate } from './affiliate-config.ts';

Deno.test('eSIM şablonu: https ve {url} gerekir', () => {
  assertEquals(validEsimTemplate('https://airalo.pxf.io/c/1/2/3?u={url}'), true);
  assertEquals(validEsimTemplate('http://x.example/?u={url}'), false);
  assertEquals(validEsimTemplate('https://x.example/'), false);
  assertEquals(validEsimTemplate(undefined), false);
});

Deno.test('Amazon kimlikleri: geçerli olanlar alınır, bozuk giriş boş döner', () => {
  assertEquals(parseAmazonTags('{"TR":"yola-21","de":"x","US":"yola-20","FR":"a b"}'), { TR: 'yola-21', US: 'yola-20' });
  assertEquals(parseAmazonTags('bozuk'), {});
  assertEquals(parseAmazonTags('[1,2]'), {});
  assertEquals(parseAmazonTags(undefined), {});
});

Deno.test('readAffiliateConfig: yalnızca doğrulanmış değerler', () => {
  const env: Record<string, string> = { AFFILIATE_ESIM_AIRALO_URL: ' https://a.example/?u={url} ', AFFILIATE_ESIM_HOLAFLY_URL: 'javascript:alert(1)', AFFILIATE_AMAZON_TAGS: '{"TR":"yola-21"}' };
  assertEquals(readAffiliateConfig((n) => env[n]), { esim: { airalo: 'https://a.example/?u={url}' }, amazon: { TR: 'yola-21' } });
  assertEquals(readAffiliateConfig(() => undefined), { esim: {}, amazon: {} });
});
