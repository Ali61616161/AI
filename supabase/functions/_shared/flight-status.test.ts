import { assertEquals } from 'jsr:@std/assert@1';

import { alertLevel, cacheTtlMin, localDate, normalizeFlightNumber, parseFlights } from './flight-status.ts';

Deno.test('uçuş numarası düzenlenir, geçersizi reddedilir', () => {
  assertEquals(normalizeFlightNumber('tk 1865'), 'TK1865');
  assertEquals(normalizeFlightNumber('TK-1865'), 'TK1865');
  assertEquals(normalizeFlightNumber('U2 12'), 'U212');
  assertEquals(normalizeFlightNumber('Istanbul'), null);
  assertEquals(normalizeFlightNumber(null), null);
  assertEquals(normalizeFlightNumber('TK'), null);
});

Deno.test('yerel tarih saat dilimine göre', () => {
  assertEquals(localDate('2026-10-26T22:30:00Z', 'Europe/Istanbul'), '2026-10-27');
  assertEquals(localDate('2026-10-26T22:30:00Z', 'Europe/London'), '2026-10-26');
  assertEquals(localDate('2026-10-26T22:30:00Z', 'Not/AZone'), '2026-10-26');
});

Deno.test('önbellek ömrü: uzak uçuş sorgulanmaz, yaklaştıkça sıklaşır', () => {
  assertEquals(cacheTtlMin(48 * 60), null);
  assertEquals(cacheTtlMin(12 * 60), 180);
  assertEquals(cacheTtlMin(3 * 60), 45);
  assertEquals(cacheTtlMin(30), 15);
  assertEquals(cacheTtlMin(-30), 30);
  assertEquals(cacheTtlMin(-300, 90), null, 'indikten 1 saat sonra bırakılır');
});

const sample = [
  { number: 'TK 1865', status: 'Expected', departure: { airport: { iata: 'ZRH' }, scheduledTime: { utc: '2026-10-26 15:30Z' }, revisedTime: { utc: '2026-10-26 16:15Z' }, terminal: '2', gate: 'A14' }, arrival: { airport: { iata: 'IST' }, scheduledTime: { utc: '2026-10-26 18:50Z' }, revisedTime: { utc: '2026-10-26 19:30Z' }, baggageBelt: '7' } },
  { number: 'TK 1865', status: 'Canceled', departure: { airport: { iata: 'IST' }, scheduledTime: { utc: '2026-10-27 05:00Z' } }, arrival: { airport: { iata: 'ZRH' } } },
];

Deno.test('yanıttan doğru bacak seçilir ve gecikme hesaplanır', () => {
  const s = parseFlights(sample, 'zrh')!;
  assertEquals(s.state, 'delayed', '45 dk gecikme "beklenen" durumunu gecikmeye çevirir');
  assertEquals(s.departure.delay_min, 45);
  assertEquals(s.departure.gate, 'A14');
  assertEquals(s.arrival.baggage_belt, '7');
  assertEquals(s.arrival.delay_min, 40);
  assertEquals(alertLevel(s), 'delay');
  const c = parseFlights(sample, 'IST')!;
  assertEquals(c.state, 'canceled');
  assertEquals(alertLevel(c), 'canceled');
  assertEquals(parseFlights(sample, null)!.departure.gate, 'A14', 'kalkış belirsizse ilk bacak');
});

Deno.test('boş ya da bozuk yanıt', () => {
  assertEquals(parseFlights([], 'IST'), null);
  assertEquals(parseFlights({ error: 'x' }, 'IST'), null);
  const s = parseFlights([{ status: 'Expected', departure: {}, arrival: {} }], null)!;
  assertEquals(s.departure.delay_min, 0);
  assertEquals(alertLevel(s), 'none');
});
