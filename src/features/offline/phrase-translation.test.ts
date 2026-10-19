import { assertEquals } from 'jsr:@std/assert@1';

import { buildBatch, isRtlLanguage, parseBatch } from './phrase-translation.ts';

Deno.test('toplu istek numaralanır, çeviri sıraya döner', () => {
  assertEquals(buildBatch(['Help!', 'Call\nthe police.']), '1| Help!\n2| Call the police.');
  assertEquals(parseBatch('1| Ayuda!\n2| Llame a la policía.', 2), ['Ayuda!', 'Llame a la policía.']);
  assertEquals(parseBatch('1. A\n\n 2) B\n3：C', 3), ['A', 'B', 'C']);
});

Deno.test('eksik ya da bozuk çeviri reddedilir', () => {
  assertEquals(parseBatch('1| A', 2), null);
  assertEquals(parseBatch('serbest metin', 1), null);
  assertEquals(parseBatch('5| A', 2), null);
});

Deno.test('sağdan sola diller', () => {
  assertEquals(isRtlLanguage('ar'), true);
  assertEquals(isRtlLanguage('he'), true);
  assertEquals(isRtlLanguage('fa-IR'), true);
  assertEquals(isRtlLanguage('tr'), false);
});
