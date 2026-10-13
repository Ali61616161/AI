import { assert, assertEquals } from 'jsr:@std/assert@1';

import { navigationUrl, partnersFor, ticketOptions, transportTemplatesFromEnv } from './transport.ts';

Deno.test('partnersFor: bölgeye ve araca göre ortak sırası', () => {
  assertEquals(partnersFor('train', 'CH')[0], 'trainline');
  assertEquals(partnersFor('train', 'TH')[0], '12go');
  assertEquals(partnersFor('bus', 'US')[0], 'busbud');
  assertEquals(partnersFor('bus', 'DE')[0], 'omio');
  assertEquals(partnersFor('ferry', 'GR')[0], 'ferryhopper');
  assertEquals(partnersFor('ferry', 'ID')[0], '12go');
  assertEquals(partnersFor('car', 'TR'), ['discovercars']);
  assertEquals(partnersFor('train', null)[0], 'omio');
});

Deno.test('ticketOptions: kimlik yokken yedekler (Rome2rio, Google Flights) çalışır', () => {
  const train = ticketOptions({ mode: 'train', from: 'Zürich', to: 'Grindelwald', country: 'CH' }, {});
  assertEquals(train, [{ partner: 'rome2rio', mode: 'train', url: 'https://www.rome2rio.com/map/Z%C3%BCrich/Grindelwald', affiliate: false }]);

  const flight = ticketOptions({ mode: 'flight', from: 'Istanbul', to: 'Rome', date: '2026-11-03' }, {});
  assertEquals(flight.map((o) => o.partner), ['google_flights', 'rome2rio']);
  assertEquals(flight[0].url, 'https://www.google.com/travel/flights?q=Flights+from+Istanbul+to+Rome+on+2026-11-03');

  // Araba: kiralama ortağı girilmemişse bağlantı yok (yol tarifi ayrı verilir).
  assertEquals(ticketOptions({ mode: 'car', from: 'A', to: 'B' }, {}), []);
});

Deno.test('ticketOptions: girilen ortak şablonları önce gelir, boş parametreler temizlenir', () => {
  const templates = transportTemplatesFromEnv((name) =>
    ({
      AFFILIATE_TRAINLINE_URL: 'https://www.thetrainline.com/search?from={from}&to={to}&date={date}&aff=YOLA',
      AFFILIATE_OMIO_URL: 'http://insecure.example/{from}', // https değil → yok sayılır
      AFFILIATE_KIWI_URL: 'https://www.kiwi.com/deep?from={from_iata}&to={to_iata}&affilid=yola', // IATA ister
    })[name]
  );
  assertEquals(Object.keys(templates).sort(), ['kiwi', 'trainline']);

  const train = ticketOptions({ mode: 'train', from: 'Bern', to: 'Spiez', country: 'CH' }, templates);
  assertEquals(train[0], { partner: 'trainline', mode: 'train', url: 'https://www.thetrainline.com/search?from=Bern&to=Spiez&aff=YOLA', affiliate: true });
  assertEquals(train[1].partner, 'rome2rio');

  // IATA kodu yoksa Kiwi atlanır, varsa kullanılır.
  assertEquals(ticketOptions({ mode: 'flight', from: 'Istanbul', to: 'Rome' }, templates)[0].partner, 'google_flights');
  const kiwi = ticketOptions({ mode: 'flight', from: 'Istanbul', to: 'Rome', fromIata: 'IST', toIata: 'FCO' }, templates);
  assertEquals(kiwi[0], { partner: 'kiwi', mode: 'flight', url: 'https://www.kiwi.com/deep?from=IST&to=FCO&affilid=yola', affiliate: true });
});

Deno.test('ticketOptions: en fazla limit kadar bağlantı', () => {
  const env: Record<string, string> = {
    AFFILIATE_TRAINLINE_URL: 'https://t.example/?f={from}',
    AFFILIATE_OMIO_URL: 'https://o.example/?f={from}',
  };
  assertEquals(ticketOptions({ mode: 'train', from: 'A', to: 'B', country: 'FR' }, transportTemplatesFromEnv((n) => env[n]), 2).length, 2);
});

Deno.test('navigationUrl: toplu taşıma, araba, yürüyüş', () => {
  assertEquals(navigationUrl({ lat: 46.6, lng: 8.04 }, 'Jungfraujoch', 'transit'), 'https://www.google.com/maps/dir/?api=1&destination=Jungfraujoch&travelmode=transit&origin=46.6%2C8.04');
  assert(navigationUrl(null, { lat: 1, lng: 2 }, 'drive').endsWith('travelmode=driving'));
  assert(navigationUrl(null, 'X', 'walk').includes('travelmode=walking'));
});
