import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { GOOGLE_SCHEMA, validateObject } from './google/validate.ts';
import { isLanguageCode, MAX_TEXT_LENGTH, normalizeImageTranslation, TRANSLATE_PATH, translateRequest, TranslateError, translateText } from './translate.ts';

const T = GOOGLE_SCHEMA.translate;

Deno.test('Translation: adres ve istek gövdesi resmi şemaya uyar', () => {
  assertEquals(`${T.servicePath}v2`, TRANSLATE_PATH);
  assert('v2' in T.methods);
  assertEquals(validateObject(T.schemas, 'TranslateTextRequest', translateRequest({ text: 'Merhaba', target: 'it', source: 'tr' })), []);
  assertEquals(validateObject(T.schemas, 'TranslateTextRequest', translateRequest({ text: 'Merhaba', target: 'it' })), []);
  assertEquals(validateObject(T.schemas, 'TranslateTextRequest', { q: ['x'], target: 'it', sourceLang: 'tr' }), ['sourceLang: unknown field']);
  assert('translatedText' in T.schemas.TranslationsResource && 'detectedSourceLanguage' in T.schemas.TranslationsResource);
});

Deno.test('translateRequest: metni sınırlar, kaynak dil yoksa otomatik algılatır', () => {
  const r = translateRequest({ text: 'a'.repeat(MAX_TEXT_LENGTH + 50), target: 'en', source: null });
  assertEquals(r.q[0].length, MAX_TEXT_LENGTH);
  assertEquals('source' in r, false);
  assertEquals(r.format, 'text');
});

Deno.test('translateText: v2 yanıtını ("data" sarmalı) okur, anahtarı başlıkta gönderir', async () => {
  let headers: Record<string, string> = {};
  let url = '';
  const fetchImpl = ((u: string, init: RequestInit) => {
    url = u;
    headers = init.headers as Record<string, string>;
    return Promise.resolve(new Response(JSON.stringify({ data: { translations: [{ translatedText: 'Ciao', detectedSourceLanguage: 'tr' }] } })));
  }) as typeof fetch;
  assertEquals(await translateText({ apiKey: 'k', text: 'Merhaba', target: 'it', fetchImpl }), { text: 'Ciao', detectedSource: 'tr' });
  assertEquals(url, 'https://translation.googleapis.com/language/translate/v2');
  assertEquals(headers['X-Goog-Api-Key'], 'k');
  const failing = (() => Promise.resolve(new Response('denied', { status: 403 }))) as unknown as typeof fetch;
  await assertRejects(() => translateText({ apiKey: 'k', text: 'x', target: 'en', fetchImpl: failing }), TranslateError, 'http 403');
});

Deno.test('isLanguageCode: BCP-47 kısa kodlar', () => {
  for (const ok of ['tr', 'en', 'pt-BR', 'zh-CN', 'fil']) assert(isLanguageCode(ok), ok);
  for (const bad of ['', 'EN', 'english', 'tr_TR', 'zh-', 42]) assert(!isLanguageCode(bad), String(bad));
});

Deno.test('normalizeImageTranslation: eksik ve hatalı kalemleri atar, alanları sınırlar', () => {
  const r = normalizeImageTranslation({
    kind: 'menu',
    source_language: 'it',
    summary: ' İtalyan restoran menüsü ',
    items: [
      { original: 'Cacio e pepe', translated: 'Peynirli karabiberli makarna', note: 'Pecorino, karabiber. Gluten, süt.', price: '€12', section: 'Primi' },
      { original: 'Acqua', translated: '' },
      { translated: 'sahipsiz' },
    ],
  });
  assertEquals(r.kind, 'menu');
  assertEquals(r.sourceLanguage, 'it');
  assertEquals(r.summary, 'İtalyan restoran menüsü');
  assertEquals(r.items, [{ original: 'Cacio e pepe', translated: 'Peynirli karabiberli makarna', note: 'Pecorino, karabiber. Gluten, süt.', price: '€12', section: 'Primi' }]);
  assertEquals(normalizeImageTranslation({ kind: 'poster' }), { kind: 'other', sourceLanguage: null, summary: '', items: [] });
});

import { normalizeVisa } from './travel-info.ts';

Deno.test('normalizeVisa: bilinmeyen değerleri "unknown" yapar, güvensiz bağlantıyı atar', () => {
  const v = normalizeVisa({ requirement: 'evisa', max_stay_days: 30, summary: ' e-Vize gerekir ', documents: ['Pasaport', '', 5], notes: [], official_url: 'https://evisa.example.gov' });
  assertEquals(v, { requirement: 'evisa', maxStayDays: 30, summary: 'e-Vize gerekir', documents: ['Pasaport'], notes: [], officialUrl: 'https://evisa.example.gov' });
  const bad = normalizeVisa({ requirement: 'maybe', max_stay_days: -1, official_url: 'javascript:alert(1)' });
  assertEquals([bad.requirement, bad.maxStayDays, bad.officialUrl], ['unknown', null, null]);
});
