import { assert, assertEquals } from 'jsr:@std/assert@1';

import { PHRASE_LANGUAGES, PHRASES, phraseLanguageForCountry, SPEECH_LOCALE } from './phrases.ts';

Deno.test('Acil durum cümleleri: her cümle 16 dilde dolu ve anahtarlar benzersiz', () => {
  assertEquals(new Set(PHRASES.map((p) => p.key)).size, PHRASES.length);
  for (const p of PHRASES) {
    for (const lang of PHRASE_LANGUAGES) assert(p.text[lang]?.trim(), `${p.key}.${lang} boş`);
    assertEquals(Object.keys(p.text).sort(), [...PHRASE_LANGUAGES].sort());
  }
  for (const lang of PHRASE_LANGUAGES) assert(SPEECH_LOCALE[lang]);
});

Deno.test('phraseLanguageForCountry: ülkenin dili, yoksa İngilizce', () => {
  assertEquals(phraseLanguageForCountry('it'), 'it');
  assertEquals(phraseLanguageForCountry('MX'), 'es');
  assertEquals(phraseLanguageForCountry('AE'), 'ar');
  assertEquals(phraseLanguageForCountry('JP'), 'ja');
  assertEquals(phraseLanguageForCountry('BR'), 'pt');
  assertEquals(phraseLanguageForCountry('TH'), 'en');
  assertEquals(phraseLanguageForCountry(null), 'en');
});
