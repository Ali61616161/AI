import { assertEquals } from 'jsr:@std/assert@1';

import { convert, FX_TTL_MS, isFresh, parseRate, rateKey } from './fx-logic.ts';

Deno.test('parseRate geçerli ve geçersiz yanıtlar', () => {
  assertEquals(parseRate({ rates: { TRY: 38.5 } }, 'try'), 38.5);
  assertEquals(parseRate({ rates: { TRY: 'x' } }, 'TRY'), null);
  assertEquals(parseRate({ rates: { TRY: 0 } }, 'TRY'), null);
  assertEquals(parseRate(null, 'TRY'), null);
});

Deno.test('önbellek tazeliği', () => {
  assertEquals(isFresh({ rate: 1, at: 1000 }, 1000 + FX_TTL_MS - 1), true);
  assertEquals(isFresh({ rate: 1, at: 1000 }, 1000 + FX_TTL_MS), false);
  assertEquals(isFresh(undefined, 0), false);
});

Deno.test('anahtar ve dönüşüm', () => {
  assertEquals(rateKey('eur', 'try'), 'EUR>TRY');
  assertEquals(convert(10, 38.456), 384.56);
});

Deno.test('CURRENCIES: benzersiz ve üç harfli', async () => {
  const { CURRENCIES } = await import('./fx-logic.ts');
  assertEquals(new Set(CURRENCIES).size, CURRENCIES.length);
  assertEquals(CURRENCIES.every((c) => /^[A-Z]{3}$/.test(c)), true);
});

Deno.test('currencyFlag: her para biriminin bayrağı var', async () => {
  const { CURRENCIES, currencyFlag } = await import('./fx-logic.ts');
  assertEquals(currencyFlag('TRY'), '🇹🇷');
  assertEquals(currencyFlag('eur'), '🇪🇺');
  assertEquals(currencyFlag('XXX'), '');
  assertEquals(CURRENCIES.filter((c) => !currencyFlag(c)), []);
});

Deno.test('parseAmount: TR/EN ondalık ve binlik ayırıcılar', async () => {
  const { parseAmount } = await import('./fx-logic.ts');
  assertEquals(parseAmount('12,5'), 12.5);
  assertEquals(parseAmount('12.5'), 12.5);
  assertEquals(parseAmount('1.234,56'), 1234.56);
  assertEquals(parseAmount('1,234.56'), 1234.56);
  assertEquals(parseAmount('1.000'), 1000);
  assertEquals(parseAmount('1 000'), 1000);
  assertEquals(parseAmount(''), null);
  assertEquals(parseAmount('abc'), null);
});
