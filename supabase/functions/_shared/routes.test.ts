import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { computeRoutes, normalizeRoutes, ROUTE_FIELD_MASK, routesRequest, RoutesError } from './routes.ts';

// Gerçek API biçiminde örnek: İsviçre'de bir köy treni + teleferik + yürüyüş.
const SAMPLE = {
  routes: [{
    duration: '5400s',
    distanceMeters: 61234,
    localizedValues: { duration: { text: '1 saat 30 dk' }, distance: { text: '61,2 km' }, transitFare: { text: 'CHF 34.00' } },
    travelAdvisory: { transitFare: { currencyCode: 'CHF', units: '34' } },
    legs: [{
      steps: [
        { travelMode: 'WALK', staticDuration: '120s', distanceMeters: 150, navigationInstruction: { instructions: 'Interlaken Ost istasyonuna yürü' } },
        { travelMode: 'WALK', staticDuration: '60s', distanceMeters: 50 },
        {
          travelMode: 'TRANSIT',
          staticDuration: '2100s',
          distanceMeters: 20000,
          transitDetails: {
            headsign: 'Grindelwald',
            stopCount: 4,
            stopDetails: { departureStop: { name: 'Interlaken Ost' }, arrivalStop: { name: 'Grindelwald' }, departureTime: '2026-11-03T08:05:00Z' },
            localizedValues: { departureTime: { time: { text: '09:05' } }, arrivalTime: { time: { text: '09:40' } } },
            transitLine: {
              name: 'Berner Oberland-Bahn',
              nameShort: 'R61',
              color: '#e2001a',
              textColor: '#ffffff',
              agencies: [{ name: 'BOB', uri: 'http://www.jungfrau.ch/' }],
              vehicle: { type: 'RAIL', name: { text: 'Tren' } },
            },
          },
        },
        {
          travelMode: 'TRANSIT',
          staticDuration: '1500s',
          distanceMeters: 6000,
          transitDetails: {
            stopDetails: { departureStop: { name: 'Grindelwald Terminal' }, arrivalStop: { name: 'Eigergletscher' } },
            localizedValues: { departureTime: { time: { text: '09:50' } }, arrivalTime: { time: { text: '10:15' } } },
            transitLine: { name: 'Eiger Express', color: 'red', vehicle: { type: 'GONDOLA_LIFT' } },
          },
        },
        { travelMode: 'TRANSIT', staticDuration: '600s', transitDetails: { transitLine: { vehicle: { type: 'FERRY' } } } },
      ],
    }],
  }],
};

Deno.test('normalizeRoutes: hatlar, araç türleri, işletmeci sitesi, ücret ve yürüme birleştirme', () => {
  const [r] = normalizeRoutes(SAMPLE, 'transit');
  assertEquals(r.durationMin, 90);
  assertEquals(r.distanceKm, 61.2);
  assertEquals(r.fare, { amount: 34, currency: 'CHF' });
  assertEquals(r.fareText, 'CHF 34.00');
  assertEquals(r.departAt, '09:05');
  assertEquals(r.arriveAt, '10:15'); // son adımın saati yoksa bilinen son varış
  assertEquals(r.steps.length, 4);
  assertEquals(r.steps[0], { mode: 'walk', durationMin: 3, distanceM: 200, instruction: 'Interlaken Ost istasyonuna yürü', transit: null });
  const train = r.steps[1].transit!;
  assertEquals([train.vehicle, train.lineShort, train.color, train.agency, train.agencyUrl, train.from, train.to, train.stops], ['train', 'R61', '#e2001a', 'BOB', 'https://www.jungfrau.ch/', 'Interlaken Ost', 'Grindelwald', 4]);
  assertEquals(train.longDistance, false);
  const gondola = r.steps[2].transit!;
  assertEquals([gondola.vehicle, gondola.color, gondola.agency], ['cable_car', null, null]);
  assertEquals(r.steps[3].transit!.vehicle, 'ferry');
  assertEquals(r.steps[3].transit!.longDistance, true);
});

Deno.test('normalizeRoutes: boş/bozuk cevap ve araba özeti', () => {
  assertEquals(normalizeRoutes({}, 'transit'), []);
  assertEquals(normalizeRoutes({ routes: [{}] }, 'transit')[0].steps, []);
  const [car] = normalizeRoutes({ routes: [{ duration: '3600s', distanceMeters: 80000, legs: [{ steps: [{ travelMode: 'DRIVE', staticDuration: '100s' }] }] }] }, 'drive');
  assertEquals([car.durationMin, car.distanceKm, car.steps.length, car.fare], [60, 80, 0, null]);
});

Deno.test('routesRequest: mod, geçmiş saat gönderilmez, adres veya koordinat', () => {
  const body = routesRequest({ origin: { lat: 46.68, lng: 7.86 }, destination: { address: 'Jungfraujoch' }, mode: 'transit', departAt: '2001-01-01T00:00:00Z', language: 'tr' });
  assertEquals(body.travelMode, 'TRANSIT');
  assertEquals(body.origin, { location: { latLng: { latitude: 46.68, longitude: 7.86 } } });
  assertEquals(body.destination, { address: 'Jungfraujoch' });
  assertEquals('departureTime' in body, false);
  const future = new Date(Date.now() + 86_400_000).toISOString();
  assert('departureTime' in routesRequest({ origin: { address: 'a' }, destination: { address: 'b' }, mode: 'drive', departAt: future, language: 'en' }));
});

Deno.test('computeRoutes: başlıklar ve hata', async () => {
  let headers: Headers | null = null;
  const ok = ((_url: string, init: RequestInit) => {
    headers = new Headers(init.headers);
    return Promise.resolve(new Response(JSON.stringify(SAMPLE)));
  }) as typeof fetch;
  const routes = await computeRoutes({ apiKey: 'k', origin: { address: 'a' }, destination: { address: 'b' }, mode: 'transit', language: 'en', fetchImpl: ok });
  assertEquals(routes.length, 1);
  assertEquals(headers!.get('x-goog-fieldmask'), ROUTE_FIELD_MASK);
  assertEquals(headers!.get('x-goog-api-key'), 'k');
  const bad = (() => Promise.resolve(new Response('denied', { status: 403 }))) as typeof fetch;
  await assertRejects(() => computeRoutes({ apiKey: 'k', origin: { address: 'a' }, destination: { address: 'b' }, mode: 'walk', language: 'en', fetchImpl: bad }), RoutesError);
});
