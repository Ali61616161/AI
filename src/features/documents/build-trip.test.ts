import { assertEquals, assertThrows } from 'jsr:@std/assert@1';

import type { Endpoint, ParsedItem } from '../../../supabase/functions/_shared/documents.ts';
import { buildTripDraft, type DraftItem } from './build-trip.ts';

const ep = (p: Partial<Endpoint>): Endpoint => ({
  local_datetime: null,
  timezone: null,
  place_name: null,
  code: null,
  city: null,
  country_code: null,
  address: null,
  ...p,
});

let n = 0;
const item = (type: ParsedItem['type'], title: string, start: Partial<Endpoint>, end?: Partial<Endpoint>): DraftItem => ({
  key: `k${n++}`,
  documentId: 'doc-1',
  type,
  title,
  provider_name: null,
  reference_code: null,
  start: ep(start),
  end: end ? ep(end) : null,
  details: {},
  confidence: {},
});

const outbound = item(
  'flight',
  'TK1865',
  { local_datetime: '2026-11-01T08:10', timezone: 'Europe/Istanbul', city: 'Istanbul', code: 'IST' },
  { local_datetime: '2026-11-01T09:45', timezone: 'Europe/Rome', city: 'Rome', code: 'FCO', country_code: 'IT' },
);
const romeHotel = item(
  'hotel',
  'Hotel Roma',
  { local_datetime: '2026-11-01T15:00', timezone: 'Europe/Rome', city: 'Rome', country_code: 'IT', address: 'Via Nazionale 1' },
  { local_datetime: '2026-11-03T11:00', timezone: 'Europe/Rome' },
);
const train = item(
  'train',
  'Frecciarossa 9531',
  { local_datetime: '2026-11-03T12:15', timezone: 'Europe/Rome', city: 'Rome' },
  { local_datetime: '2026-11-03T13:50', timezone: 'Europe/Rome', city: 'Florence', country_code: 'IT' },
);
const inbound = item(
  'flight',
  'TK1866',
  { local_datetime: '2026-11-06T18:30', timezone: 'Europe/Rome', city: 'Florence', code: 'FLR' },
  { local_datetime: '2026-11-06T22:55', timezone: 'Europe/Istanbul', city: 'Istanbul', code: 'IST' },
);

Deno.test('buildTripDraft: gidiş, otel, tren, dönüş → iki durak, doğru tarihler', () => {
  // Kasıtlı olarak karışık sırayla veriliyor.
  const draft = buildTripDraft([inbound, train, outbound, romeHotel]);

  assertEquals(draft.title, 'Rome · Florence');
  assertEquals(draft.start_date, '2026-11-01');
  assertEquals(draft.end_date, '2026-11-06');
  assertEquals(draft.destinations, [
    { city: 'Rome', country_code: 'IT', arrive_on: '2026-11-01', depart_on: '2026-11-03' },
    { city: 'Florence', country_code: 'IT', arrive_on: '2026-11-03', depart_on: '2026-11-06' },
  ]);
  assertEquals(draft.reservations.map((r) => r.title), ['TK1865', 'Hotel Roma', 'Frecciarossa 9531', 'TK1866']);
});

Deno.test('buildTripDraft: rezervasyon saatleri UTC, ulaşım ve otel alanları', () => {
  const draft = buildTripDraft([outbound, romeHotel]);
  const [flight, hotel] = draft.reservations;
  assertEquals(flight.starts_at, '2026-11-01T05:10:00.000Z');
  assertEquals(flight.ends_at, '2026-11-01T08:45:00.000Z');
  assertEquals([flight.origin_code, flight.destination_code], ['IST', 'FCO']);
  assertEquals(flight.address, null);
  assertEquals(hotel.address, 'Via Nazionale 1');
  assertEquals(hotel.origin_code, null);
});

Deno.test('buildTripDraft: sadece otel yüklenirse otel şehri durak olur', () => {
  const draft = buildTripDraft([romeHotel]);
  assertEquals(draft.title, 'Rome');
  assertEquals(draft.destinations, [{ city: 'Rome', country_code: 'IT', arrive_on: '2026-11-01', depart_on: '2026-11-03' }]);
});

Deno.test('buildTripDraft: başlangıçtan önceki bitiş saati kaydedilmez', () => {
  const broken = item(
    'hotel',
    'Ters tarih',
    { local_datetime: '2026-11-05T15:00', city: 'Milan' },
    { local_datetime: '2026-11-01T11:00' },
  );
  assertEquals(buildTripDraft([broken]).reservations[0].ends_at, null);
});

Deno.test('buildTripDraft: ev şehri verilirse dönüş varışı durak sayılmaz', () => {
  const draft = buildTripDraft([outbound, inbound], { homeCity: 'istanbul' });
  assertEquals(draft.destinations.map((d) => d.city), ['Rome']);
  assertEquals(draft.destinations[0].depart_on, '2026-11-06');
});

Deno.test('buildTripDraft: tarihsiz liste hata verir', () => {
  assertThrows(() => buildTripDraft([]));
});
