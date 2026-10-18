import { assert, assertEquals } from 'jsr:@std/assert@1';

import { buildExtractionPrompt, localToUtcIso, minConfidence, normalizeLocalDateTime, normalizeParsedDocument } from './documents.ts';

Deno.test('localToUtcIso: İstanbul yıl boyu UTC+3', () => {
  assertEquals(localToUtcIso('2026-07-15T10:00', 'Europe/Istanbul'), '2026-07-15T07:00:00.000Z');
  assertEquals(localToUtcIso('2026-01-15T10:00', 'Europe/Istanbul'), '2026-01-15T07:00:00.000Z');
});

Deno.test('localToUtcIso: Roma yaz ve kış saati', () => {
  assertEquals(localToUtcIso('2026-07-15T14:30', 'Europe/Rome'), '2026-07-15T12:30:00.000Z');
  assertEquals(localToUtcIso('2026-12-15T14:30', 'Europe/Rome'), '2026-12-15T13:30:00.000Z');
});

Deno.test('localToUtcIso: yaz saati geçiş günü (29 Mart 2026, Roma)', () => {
  // 03:30 yerel saat, geçişten sonra UTC+2.
  assertEquals(localToUtcIso('2026-03-29T03:30', 'Europe/Rome'), '2026-03-29T01:30:00.000Z');
});

Deno.test('localToUtcIso: negatif fark ve saat dilimi yoksa UTC', () => {
  assertEquals(localToUtcIso('2026-11-01T08:00', 'America/New_York'), '2026-11-01T13:00:00.000Z');
  assertEquals(localToUtcIso('2026-11-01T08:00', null), '2026-11-01T08:00:00.000Z');
  assertEquals(localToUtcIso('2026-11-01T08:00', 'Not/AZone'), '2026-11-01T08:00:00.000Z');
});

Deno.test('normalizeLocalDateTime: biçimleri kabul eder, geçersizleri reddeder', () => {
  assertEquals(normalizeLocalDateTime('2026-11-01T14:30'), '2026-11-01T14:30');
  assertEquals(normalizeLocalDateTime('2026-11-01 14:30:00'), '2026-11-01T14:30');
  assertEquals(normalizeLocalDateTime('2026-11-01'), '2026-11-01T00:00');
  assertEquals(normalizeLocalDateTime('2026-13-01T10:00'), null);
  assertEquals(normalizeLocalDateTime('01/11/2026'), null);
  assertEquals(normalizeLocalDateTime(42), null);
});

Deno.test('normalizeParsedDocument: aktarmalı uçuş ve otel, sıralı ve temiz', () => {
  const doc = normalizeParsedDocument({
    document_type: 'flight',
    passenger_names: ['  AYSE YILMAZ  ', 7],
    items: [
      {
        type: 'hotel',
        title: 'Hotel Santa Maria Novella',
        reference_code: 'abc-123',
        start: { local_datetime: '2026-11-01T15:00', timezone: 'Europe/Rome', city: 'Florence', country_code: 'it' },
        end: { local_datetime: '2026-11-04T11:00', timezone: 'Europe/Rome' },
        details: { breakfast_included: true, guests: 2, junk: null, 'Bad Key': 'x' },
        confidence: { title: 0.98, start_datetime: 1.4, end_datetime: -2 },
      },
      {
        type: 'flight',
        title: 'TK1865 IST → FCO',
        provider_name: 'Turkish Airlines',
        start: { local_datetime: '2026-11-01T08:10', timezone: 'Europe/Istanbul', code: 'ist', city: 'Istanbul' },
        end: { local_datetime: '2026-11-01T09:45', timezone: 'Europe/Rome', code: 'FCO', city: 'Rome' },
        details: { flight_number: 'TK1865', seat: '14C' },
      },
      { type: 'flight', title: 'tarihsiz', start: { place_name: 'IST' } },
      'çöp',
    ],
  });

  assertEquals(doc.items.length, 2, 'tarihsiz ve bozuk kalemler atılmalı');
  assertEquals(doc.items[0].type, 'flight', 'kalemler tarihe göre sıralanmalı');
  assertEquals(doc.document_type, 'flight');
  assertEquals(doc.items[0].start.code, 'IST');
  assertEquals(doc.items[1].reference_code, 'ABC123');
  assertEquals(doc.items[1].start.country_code, 'IT');
  assertEquals(doc.items[1].details, { breakfast_included: true, guests: 2 });
  assertEquals(doc.items[1].confidence, { title: 0.98, start_datetime: 1, end_datetime: 0 });
  assertEquals(doc.passenger_names, ['AYSE YILMAZ']);
});

Deno.test('normalizeParsedDocument: seyahat belgesi değilse boş döner', () => {
  const doc = normalizeParsedDocument({ document_type: 'other', items: [] });
  assertEquals(doc.items, []);
  assertEquals(doc.document_type, 'other');
  assertEquals(normalizeParsedDocument(null).items, []);
  assertEquals(normalizeParsedDocument({ items: 'x' }).items, []);
});

Deno.test('normalizeParsedDocument: bilinmeyen tür "other" olur, geçersiz saat dilimi atılır', () => {
  const doc = normalizeParsedDocument({
    items: [{ type: 'spaceship', title: 'X', start: { local_datetime: '2026-05-01T10:00', timezone: 'Mars/Base' } }],
  });
  assertEquals(doc.items[0].type, 'other');
  assertEquals(doc.items[0].start.timezone, null);
});

Deno.test('minConfidence: en düşük skor, skor yoksa 0.5', () => {
  const [item] = normalizeParsedDocument({
    items: [{ type: 'event', title: 'Konser', start: { local_datetime: '2026-05-01T20:00' }, confidence: { a: 0.9, b: 0.4 } }],
  }).items;
  assertEquals(minConfidence(item), 0.4);
  assert(minConfidence({ ...item, confidence: {} }) === 0.5);
});

Deno.test('buildExtractionPrompt: bugünün tarihi, yıl çıkarımı ve gidiş-dönüş kuralı istemde', () => {
  const prompt = buildExtractionPrompt('2026-10-18');
  assert(prompt.includes('TODAY is 2026-10-18'));
  assert(prompt.includes('nearest upcoming date'));
  assert(prompt.includes('round trip is TWO items'));
  assert(prompt.includes('character by character'));
});

Deno.test('normalizeParsedDocument: uçuş PNR uzunluğu 5-7 dışındaysa güven düşer, değer aynı kalır', () => {
  const item = (code: string) => ({
    type: 'flight',
    title: 'IST → ZRH',
    reference_code: code,
    start: { local_datetime: '2027-01-11T12:45', timezone: 'Europe/Istanbul' },
    confidence: { reference_code: 0.95 },
  });
  const odd = normalizeParsedDocument({ items: [item('V2JXVMWES')] }).items[0];
  assertEquals(odd.reference_code, 'V2JXVMWES');
  assertEquals(odd.confidence.reference_code, 0.5);
  const ok = normalizeParsedDocument({ items: [item('V2JXVM')] }).items[0];
  assertEquals(ok.confidence.reference_code, 0.95);
  // PNR eksik güven skoruyla gelse bile düşük olarak işaretlenir.
  const noScore = normalizeParsedDocument({ items: [{ ...item('AB'), confidence: {} }] }).items[0];
  assertEquals(noScore.confidence.reference_code, 0.5);
});
