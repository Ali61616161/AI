import { assertEquals } from 'jsr:@std/assert@1';

import { pickVoice, previewText, rankVoices } from './voices.ts';

const v = (identifier: string, name: string, language: string, quality = 'Default') => ({ identifier, name, language, quality });
const voices = [
  v('com.apple.voice.compact.tr-TR.Yelda', 'Yelda', 'tr-TR'),
  v('com.apple.voice.enhanced.tr-TR.Yelda', 'Yelda (Enhanced)', 'tr-TR', 'Enhanced'),
  v('com.apple.speech.synthesis.voice.Zarvox', 'Zarvox', 'en-US'),
  v('com.apple.voice.compact.en-US.Samantha', 'Samantha', 'en-US'),
  v('com.apple.ttsbundle.siri_Nicky_en-US_premium', 'Nicky', 'en-US', 'Enhanced'),
  v('com.apple.voice.compact.de-DE.Anna', 'Anna', 'de-DE'),
  v('tr-tr-x-ama-network', 'tr-TR-ama', 'tr-TR'),
  v('tr-tr-x-ama-local', 'tr-TR-ama-local', 'tr-TR'),
];

Deno.test('rankVoices: gelişmiş/Siri önce, kompakt sonra; efekt sesleri ve başka diller dışarıda', () => {
  const tr = rankVoices(voices, 'tr-TR').map((x) => x.identifier);
  assertEquals(tr[0], 'com.apple.voice.enhanced.tr-TR.Yelda');
  assertEquals(tr.includes('com.apple.voice.compact.tr-TR.Yelda'), true);
  assertEquals(tr.indexOf('tr-tr-x-ama-network') < tr.indexOf('tr-tr-x-ama-local'), true);
  assertEquals(tr.some((id) => id.includes('Zarvox') || id.includes('de-DE')), false);
  const en = rankVoices(voices, 'en-US').map((x) => x.identifier);
  assertEquals(en[0], 'com.apple.ttsbundle.siri_Nicky_en-US_premium');
  assertEquals(en.includes('com.apple.speech.synthesis.voice.Zarvox'), false);
});

Deno.test('rankVoices: tam yerel ayar eşleşmesi aynı dildeki başka bölgeden önce gelir', () => {
  const list = [v('a-compact', 'UK', 'en-GB'), v('b-compact', 'US', 'en-US')];
  assertEquals(rankVoices(list, 'en-US')[0].name, 'US');
  assertEquals(rankVoices(list, 'en_GB')[0].name, 'UK');
});

Deno.test('pickVoice: seçilen ses geçerliyse o, değilse en iyi, hiç yoksa null', () => {
  assertEquals(pickVoice(voices, 'tr-TR', 'com.apple.voice.compact.tr-TR.Yelda')?.name, 'Yelda');
  assertEquals(pickVoice(voices, 'tr-TR', 'silinmis-ses')?.identifier, 'com.apple.voice.enhanced.tr-TR.Yelda');
  assertEquals(pickVoice(voices, 'tr-TR')?.identifier, 'com.apple.voice.enhanced.tr-TR.Yelda');
  assertEquals(pickVoice(voices, 'ja-JP'), null);
  assertEquals(pickVoice([], 'tr-TR'), null);
});

Deno.test('previewText: dile göre cümle, bilinmeyen dilde İngilizce', () => {
  assertEquals(previewText('tr-TR').startsWith('Merhaba'), true);
  assertEquals(previewText('zh_CN').startsWith('你好'), true);
  assertEquals(previewText('sw-KE').startsWith('Hello'), true);
});
