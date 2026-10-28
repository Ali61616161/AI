import { assertEquals } from 'jsr:@std/assert@1';

import { CHUNK_SIZE, joinChunks, safeKey, splitChunks } from './chunk-storage.ts';

Deno.test('bölme ve birleştirme aynı değeri verir', () => {
  const value = 'x'.repeat(CHUNK_SIZE * 2 + 17) + 'çğ✓';
  const parts = splitChunks(value);
  assertEquals(parts.length, 3);
  assertEquals(joinChunks(parts.length, (i) => parts[i]), value);
  assertEquals(joinChunks(1, () => ''), '');
  assertEquals(splitChunks(''), ['']);
});

Deno.test('eksik parça ya da geçersiz sayı null döner', () => {
  const parts = splitChunks('a'.repeat(4000));
  assertEquals(joinChunks(parts.length, (i) => (i === 1 ? null : parts[i])), null);
  assertEquals(joinChunks(0, () => 'a'), null);
  assertEquals(joinChunks(1000, () => 'a'), null);
  assertEquals(joinChunks(Number.NaN, () => 'a'), null);
});

Deno.test('anahtar güvenli karakterlere çevrilir', () => {
  assertEquals(safeKey('sb-abc-auth-token'), 'sb-abc-auth-token');
  assertEquals(safeKey('a b/c:d'), 'a_b_c_d');
});
