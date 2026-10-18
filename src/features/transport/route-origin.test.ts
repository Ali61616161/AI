import { assertEquals } from 'jsr:@std/assert@1';

import { distanceKm, FAR_KM, isFar, pickTripOrigin } from './route-origin.ts';

const res = (over: Record<string, unknown>) => ({ type: 'flight', title: 'IST → ZRH', starts_at: '2027-01-11T09:45:00Z', address: null, destination_name: null, destination_code: null, ...over });

Deno.test('isFar: aynı şehir yakın, Büyükçekmece–Zürih uzak', () => {
  const home = { lat: 41.0214, lng: 28.5778 };
  assertEquals(isFar(home, { lat: 41.0082, lng: 28.9784 }), false);
  assertEquals(isFar(home, { lat: 47.3779, lng: 8.5403 }), true);
  assertEquals(FAR_KM, 150);
  assertEquals(Math.round(distanceKm(home, { lat: 47.3779, lng: 8.5403 }) / 100), 17);
});

Deno.test('pickTripOrigin: otel varsa adresiyle, uçuş varsa varış havalimanı, yoksa null', () => {
  const hotel = res({ type: 'hotel', title: 'Hotel Rössli', address: 'Predigerplatz 1, Zürich', starts_at: '2027-01-11T14:00:00Z' });
  const flight = res({ destination_name: 'Zurich', destination_code: 'ZRH' });
  assertEquals(pickTripOrigin([flight, hotel]), { address: 'Hotel Rössli, Predigerplatz 1, Zürich', name: 'Hotel Rössli' });
  assertEquals(pickTripOrigin([flight]), { address: 'Zurich Airport', name: 'Zurich' });
  assertEquals(pickTripOrigin([res({ destination_name: 'Zürich Flughafen' })]), { address: 'Zürich Flughafen', name: 'Zürich Flughafen' });
  assertEquals(pickTripOrigin([res({ type: 'train', destination_name: 'Zürich HB' })]), { address: 'Zürich HB', name: 'Zürich HB' });
  assertEquals(pickTripOrigin([res({ type: 'event' })]), null);
  assertEquals(pickTripOrigin([]), null);
});

Deno.test('pickTripOrigin: ilk (en erken) uçuş seçilir', () => {
  const back = res({ starts_at: '2027-01-20T15:30:00Z', destination_name: 'Istanbul' });
  const out = res({ starts_at: '2027-01-11T09:45:00Z', destination_name: 'Zurich' });
  assertEquals(pickTripOrigin([back, out])?.name, 'Zurich');
});
