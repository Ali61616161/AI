import { assertEquals } from 'jsr:@std/assert@1';

import { filesToDelete } from './tts-cache-logic.ts';

const f = (uri: string, size: number, modified: number) => ({ uri, size, modified });

Deno.test('sınırın altındaysa hiçbir şey silinmez', () => {
  assertEquals(filesToDelete([f('a', 10, 1), f('b', 20, 2)], 100), []);
});

Deno.test('sınır aşılırsa en eski dosyalar silinir, yenileri korunur', () => {
  const files = [f('yeni', 40, 30), f('eski', 40, 10), f('orta', 40, 20)];
  assertEquals(filesToDelete(files, 80).map((x) => x.uri), ['eski']);
  assertEquals(filesToDelete(files, 50).map((x) => x.uri), ['eski', 'orta']);
  assertEquals(filesToDelete(files, 0).length, 3);
});
