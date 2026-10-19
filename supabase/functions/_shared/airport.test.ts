import { assertEquals } from 'jsr:@std/assert@1';

import { airportTransferMinutes, clampTransfer, departureAirportName, lastHotelAddress, type AirportReservation } from './airport.ts';

const r = (over: Partial<AirportReservation>): AirportReservation => ({ type: 'flight', title: '', starts_at: '2027-01-10T08:00:00Z', address: null, origin_name: null, origin_code: null, ...over });

Deno.test('dönüş havalimanı ve otel adresi', () => {
  const list = [r({ origin_name: 'Istanbul Airport' }), r({ starts_at: '2027-01-20T17:00:00Z', origin_name: 'Zürich', origin_code: 'ZRH' }), r({ type: 'hotel', title: 'Hotel X', address: 'Bahnhofstrasse 1' })];
  assertEquals(departureAirportName(null, list), 'Zürich Airport');
  assertEquals(departureAirportName('Zürich Flughafen', list), 'Zürich Flughafen');
  assertEquals(departureAirportName(null, [r({ type: 'hotel' })]), null);
  assertEquals(lastHotelAddress(list), 'Hotel X, Bahnhofstrasse 1');
  assertEquals(lastHotelAddress([]), null);
});

Deno.test('yol süresi sıkıştırılır; anahtar ya da adres yoksa null', async () => {
  assertEquals([clampTransfer(3), clampTransfer(45.4), clampTransfer(900)], [10, 45, 180]);
  assertEquals(await airportTransferMinutes({ apiKey: null, reservations: [], language: 'tr' }), null);
  assertEquals(await airportTransferMinutes({ apiKey: 'k', reservations: [], language: 'tr' }), null);
});

Deno.test('airportTransferMinutes: Google rotasının süresini kullanır', async () => {
  const fetchImpl = (() => Promise.resolve(new Response(JSON.stringify({ routes: [{ duration: '1500s', distanceMeters: 12000, legs: [{ steps: [] }] }] }), { status: 200 }))) as typeof fetch;
  const list = [r({ origin_name: 'Zürich Airport' }), r({ type: 'hotel', title: 'Hotel X', address: 'Bahnhofstrasse 1' })];
  assertEquals(await airportTransferMinutes({ apiKey: 'k', reservations: list, language: 'en', fetchImpl }), 25);
});
