import { assertEquals } from 'jsr:@std/assert@1';

import { pickTtsVoice, type TtsVoice } from './tts.ts';

const voices: TtsVoice[] = [
  { name: 'de-DE-Standard-A', languageCodes: ['de-DE'], ssmlGender: 'FEMALE' },
  { name: 'de-DE-Wavenet-B', languageCodes: ['de-DE'], ssmlGender: 'MALE' },
  { name: 'de-DE-Neural2-A', languageCodes: ['de-DE'], ssmlGender: 'FEMALE' },
  { name: 'de-DE-Chirp3-HD-Aoede', languageCodes: ['de-DE'], ssmlGender: 'FEMALE' },
  { name: 'de-DE-Chirp3-HD-Puck', languageCodes: ['de-DE'], ssmlGender: 'MALE' },
  { name: 'tr-TR-Wavenet-A', languageCodes: ['tr-TR'], ssmlGender: 'FEMALE' },
  { name: 'en-GB-Neural2-A', languageCodes: ['en-GB'], ssmlGender: 'FEMALE' },
  { name: 'en-US-Chirp3-HD-Kore', languageCodes: ['en-US'], ssmlGender: 'FEMALE' },
];

Deno.test('pickTtsVoice: en doğal aile, istenen cinsiyet ve bölge', () => {
  assertEquals(pickTtsVoice(voices, 'de-DE'), { name: 'de-DE-Chirp3-HD-Aoede', languageCode: 'de-DE' });
  assertEquals(pickTtsVoice(voices, 'de-DE', 'male'), { name: 'de-DE-Chirp3-HD-Puck', languageCode: 'de-DE' });
  assertEquals(pickTtsVoice(voices, 'tr')?.name, 'tr-TR-Wavenet-A');
  // Bölge eşleşmesi aynı ailede öne geçer; daha doğal aile her zaman kazanır.
  assertEquals(pickTtsVoice(voices, 'en-GB')?.name, 'en-US-Chirp3-HD-Kore');
  assertEquals(pickTtsVoice(voices, 'ja-JP'), null);
});
