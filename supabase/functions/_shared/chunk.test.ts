import { assertEquals } from 'jsr:@std/assert@1';

import { chunkDates } from './chunk.ts';

Deno.test('chunkDates: eşit parçalar, sıra korunur', () => {
  assertEquals(chunkDates([1, 2, 3, 4, 5, 6, 7, 8, 9], 3), [[1, 2, 3], [4, 5, 6], [7, 8, 9]]);
  assertEquals(chunkDates([1, 2, 3, 4, 5, 6, 7], 3), [[1, 2, 3], [4, 5], [6, 7]]);
  assertEquals(chunkDates([1, 2], 3), [[1, 2]]);
  assertEquals(chunkDates([], 3), []);
  assertEquals(chunkDates([1, 2, 3, 4], 0).flat(), [1, 2, 3, 4]);
});
