import { assertEquals } from 'jsr:@std/assert@1';

import { cleanTexts, MAX_TEXTS, sameLanguage, textHash } from './translate-texts.ts';

Deno.test('cleanTexts: geçerli liste kırpılır, geçersizler reddedilir', () => {
  assertEquals(cleanTexts([' a ', 'b']), ['a', 'b']);
  assertEquals(cleanTexts([]), null);
  assertEquals(cleanTexts('x'), null);
  assertEquals(cleanTexts(['a', 1]), null);
  assertEquals(cleanTexts(new Array(MAX_TEXTS + 1).fill('a')), null);
  assertEquals(cleanTexts(['x'.repeat(5000)])![0].length, 2000);
});

Deno.test('textHash: aynı metin aynı özet, farklı metin farklı özet', async () => {
  assertEquals(await textHash('merhaba'), await textHash('merhaba'));
  assertEquals((await textHash('merhaba')).length, 64);
  assertEquals((await textHash('a')) === (await textHash('b')), false);
});

Deno.test('sameLanguage: bölge ekleri yok sayılır, bilinmeyen kaynak aynı sayılmaz', () => {
  assertEquals(sameLanguage('zh-CN', 'zh'), true);
  assertEquals(sameLanguage('tr', 'tr'), true);
  assertEquals(sameLanguage('en', 'tr'), false);
  assertEquals(sameLanguage(null, 'tr'), false);
});
