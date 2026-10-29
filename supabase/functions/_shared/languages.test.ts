import { assertEquals } from 'jsr:@std/assert@1';

import languages from '../../../src/i18n/languages.json' with { type: 'json' };
import { SUPPORTED_LANGUAGES } from './languages.ts';

Deno.test('sunucu dil listesi uygulamadaki languages.json ile aynı', () => {
  assertEquals([...SUPPORTED_LANGUAGES], languages.map((l) => l.code));
});
