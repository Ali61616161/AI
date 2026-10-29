import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { GOOGLE_SCHEMA, validateObject, validatePath } from './google/validate.ts';
import {
  distanceMeters,
  openNowRequest,
  fetchPhotoUri,
  fetchPlaceDetails,
  fieldMask,
  normalizePlace,
  normalizePlaceDetails,
  PLACE_DETAIL_FIELDS,
  PlacesError,
  searchText,
  verifyPlanDays,
  VERIFY_FIELDS,
} from './places.ts';

const ROME = { lat: 41.9028, lng: 12.4964 };
const raw = (id: string, name: string, lat = 41.906, lng = 12.4536, extra: Record<string, unknown> = {}) => ({
  id,
  displayName: { text: name, languageCode: 'it' },
  formattedAddress: `${name}, 00120 Roma RM, Italy`,
  shortFormattedAddress: `${name}, Roma`,
  location: { latitude: lat, longitude: lng },
  rating: 4.66,
  userRatingCount: 1234,
  priceLevel: 'PRICE_LEVEL_MODERATE',
  googleMapsUri: `https://maps.google.com/?cid=${id}`,
  primaryType: 'museum',
  businessStatus: 'OPERATIONAL',
  ...extra,
});

type Call = { url: string; headers: Record<string, string>; body: { textQuery: string } };
function stub(handler: (body: { textQuery: string }) => unknown, calls: Call[] = [], status = 200): typeof fetch {
  return ((url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    calls.push({ url, headers: init.headers as Record<string, string>, body });
    return Promise.resolve(new Response(JSON.stringify(handler(body)), { status }));
  }) as typeof fetch;
}

Deno.test('normalizePlace: alanları sadeleştirir, mesafe ve fiyat seviyesini hesaplar', () => {
  const p = normalizePlace(raw('abc', 'Musei Vaticani', 41.906, 12.4536, { currentOpeningHours: { openNow: true } }), ROME);
  assertEquals(p, {
    id: 'abc',
    name: 'Musei Vaticani',
    address: 'Musei Vaticani, Roma',
    lat: 41.906,
    lng: 12.4536,
    rating: 4.7,
    ratingCount: 1234,
    priceLevel: 2,
    priceRange: null,
    mapsUrl: 'https://maps.google.com/?cid=abc',
    type: 'museum',
    status: 'OPERATIONAL',
    openNow: true,
    distanceM: distanceMeters(ROME, { lat: 41.906, lng: 12.4536 }),
  });
  assertEquals(normalizePlace({ id: 'x' }), null);
  assertEquals(normalizePlace(raw('x', 'X', 1, 1, { googleMapsUri: 'javascript:alert(1)' }))?.mapsUrl, null);
});

Deno.test('distanceMeters: Roma–Milano ≈ 477 km', () => {
  const d = distanceMeters(ROME, { lat: 45.4642, lng: 9.19 });
  assertEquals(Math.round(d / 1000), 477);
});

Deno.test('searchText: anahtar ve alan maskesini başlıkta gönderir; hata durumunu bildirir', async () => {
  const calls: Call[] = [];
  const places = await searchText({ apiKey: 'k1', body: { textQuery: 'museum' }, fields: VERIFY_FIELDS, fetchImpl: stub(() => ({ places: [raw('a', 'A')] }), calls) });
  assertEquals(places.length, 1);
  assertEquals(calls[0].url, 'https://places.googleapis.com/v1/places:searchText');
  assertEquals(calls[0].headers['X-Goog-Api-Key'], 'k1');
  assertEquals(calls[0].headers['X-Goog-FieldMask'], fieldMask(VERIFY_FIELDS));
  assertEquals(await searchText({ apiKey: 'k', body: { textQuery: 'x' }, fetchImpl: stub(() => ({})) }), []);
  await assertRejects(() => searchText({ apiKey: 'k', body: { textQuery: 'x' }, fetchImpl: stub(() => ({ error: {} }), [], 403) }), PlacesError, 'http 403');
});

type Item = { kind: string; title: string; place_name: string | null; is_locked: boolean; google_place_id?: string | null; address?: string | null };
const item = (place_name: string | null, extra: Partial<Item> = {}): Item => ({ kind: 'activity', title: place_name ?? 'x', place_name, is_locked: false, ...extra });

Deno.test('verifyPlanDays: mekanları zenginleştirir, aynı mekanı bir kez sorar, kilitli ve ulaşım duraklarını atlar', async () => {
  const calls: Call[] = [];
  const days = [
    { city: 'Roma', items: [item('Musei Vaticani'), item('Hotel Roma', { is_locked: true }), item('Termini', { kind: 'transport' }), item(null)] },
    { city: 'Roma', items: [item('musei vaticani '), item('Trattoria Da Enzo', { kind: 'meal' })] },
  ];
  const result = await verifyPlanDays(days, {
    apiKey: 'k',
    language: 'tr',
    nearByCity: { roma: ROME },
    now: new Date('2026-10-11T10:00:00Z'),
    fetchImpl: stub((b) => ({ places: [raw(b.textQuery.startsWith('Musei') ? 'vat' : 'enzo', b.textQuery.split(',')[0])] }), calls),
  });
  assertEquals(calls.map((c) => c.body.textQuery).sort(), ['Musei Vaticani, Roma', 'Trattoria Da Enzo, Roma']);
  assertEquals(result.lookups, 2);
  assertEquals(result.verified, 3);
  const first = result.days[0].items[0] as Item & Record<string, unknown>;
  assertEquals(first.google_place_id, 'vat');
  assertEquals(first.rating, 4.7);
  assertEquals(first.lat, 41.906);
  assertEquals(first.maps_url, 'https://maps.google.com/?cid=vat');
  assertEquals(first.place_checked_at, '2026-10-11T10:00:00.000Z');
  assertEquals(result.days[0].items[1], days[0].items[1]);
  assertEquals(result.days[0].items[2], days[0].items[2]);
  assertEquals((result.days[1].items[0] as Record<string, unknown>).google_place_id, 'vat');
});

Deno.test('verifyPlanDays: başka şehirdeki aynı isimli mekanı ve hataları kabul etmez, planı bozmaz', async () => {
  const days = [{ city: 'Roma', items: [item('Pantheon'), item('Broken')] }];
  const result = await verifyPlanDays(days, {
    apiKey: 'k',
    language: 'en',
    nearByCity: { roma: ROME },
    fetchImpl: ((_: string, init: RequestInit) => {
      const q = JSON.parse(String(init.body)).textQuery as string;
      if (q.startsWith('Broken')) return Promise.reject(new Error('network down'));
      // Paris'teki Panthéon: Roma'ya ~1100 km.
      return Promise.resolve(new Response(JSON.stringify({ places: [raw('paris', 'Panthéon', 48.8462, 2.3464)] })));
    }) as typeof fetch,
  });
  assertEquals(result.verified, 0);
  assertEquals(result.failed, 1);
  assertEquals(result.days, days);
});

Deno.test('verifyPlanDays: paylaşılan önbellekle ikinci çağrı Google\'a gitmez', async () => {
  const calls: Call[] = [];
  const cache = new Map();
  const fetchImpl = stub(() => ({ places: [raw('p', 'Pantheon')] }), calls);
  await verifyPlanDays([{ city: 'Roma', items: [item('Pantheon')] }], { apiKey: 'k', language: 'en', cache, fetchImpl });
  const second = await verifyPlanDays([{ city: 'Roma', items: [item('Pantheon')] }], { apiKey: 'k', language: 'en', cache, fetchImpl });
  assertEquals(calls.length, 1);
  assertEquals((second.days[0].items[0] as Record<string, unknown>).google_place_id, 'p');
});

const PLACE_ID = 'ChIJN1t_tDeuEmsRUsoyG83frY4';
const detailRaw = () =>
  raw(PLACE_ID, 'Galata Tower', 41.0256, 28.9744, {
    primaryTypeDisplayName: { text: 'Tourist attraction' },
    websiteUri: 'https://galatakulesi.example/',
    nationalPhoneNumber: '0212 000 00 00',
    editorialSummary: { text: 'A medieval stone tower.' },
    currentOpeningHours: { openNow: true },
    regularOpeningHours: { weekdayDescriptions: ['Monday: 9:00 AM – 7:00 PM', 'Tuesday: 9:00 AM – 7:00 PM'] },
    photos: [
      { name: `places/${PLACE_ID}/photos/AUy1`, widthPx: 4000, heightPx: 3000, authorAttributions: [{ displayName: 'A. Photographer', uri: 'https://maps.google.com/contrib/1' }] },
      { name: `places/${PLACE_ID}/photos/AUy2`, authorAttributions: [] },
      { name: '../../etc/passwd' },
      { name: `places/${PLACE_ID}/photos/AUy3` },
      { name: `places/${PLACE_ID}/photos/AUy4` },
      { name: `places/${PLACE_ID}/photos/AUy5` },
    ],
  });

Deno.test('mekân kartı: istenen her alan Google Place şemasında var', () => {
  for (const field of PLACE_DETAIL_FIELDS) assertEquals(validatePath(GOOGLE_SCHEMA.places.schemas, 'GoogleMapsPlacesV1Place', field), null, field);
});

Deno.test('mekân kartı: fotoğraf adresi parametreleri Google yöntem şemasında var', () => {
  const params = GOOGLE_SCHEMA.places.methods['v1/{+name}'];
  for (const p of ['maxWidthPx', 'skipHttpRedirect']) assertEquals(params.includes(p), true, p);
});

Deno.test('normalizePlaceDetails: ayrıntılar, saatler ve en fazla 4 güvenli fotoğraf adı', () => {
  const d = normalizePlaceDetails(detailRaw())!;
  assertEquals(d.name, 'Galata Tower');
  assertEquals(d.typeLabel, 'Tourist attraction');
  assertEquals(d.website, 'https://galatakulesi.example/');
  assertEquals(d.phone, '0212 000 00 00');
  assertEquals(d.summary, 'A medieval stone tower.');
  assertEquals(d.openNow, true);
  assertEquals(d.hours.length, 2);
  // Geçersiz ad ("../../etc/passwd") elenir, en fazla 4 fotoğraf kalır.
  assertEquals(d.photoRefs.map((p) => p.name.split('/').pop()), ['AUy1', 'AUy2', 'AUy3', 'AUy4']);
  assertEquals(d.photoRefs[0].author, 'A. Photographer');
  assertEquals(d.photoRefs[1].author, null);
  assertEquals(normalizePlaceDetails({ id: 'x' }), null);
});

Deno.test('fetchPlaceDetails: GET, anahtar ve alan maskesi başlıkta; geçersiz kimlik çağrı yapmaz', async () => {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string> });
    return Promise.resolve(new Response(JSON.stringify(detailRaw()), { status: 200 }));
  }) as unknown as typeof fetch;
  const d = await fetchPlaceDetails({ apiKey: 'k1', placeId: PLACE_ID, language: 'tr', fetchImpl });
  assertEquals(d?.name, 'Galata Tower');
  assertEquals(seen[0].url, `https://places.googleapis.com/v1/places/${PLACE_ID}?languageCode=tr`);
  assertEquals(seen[0].headers['X-Goog-Api-Key'], 'k1');
  assertEquals(seen[0].headers['X-Goog-FieldMask'], PLACE_DETAIL_FIELDS.join(','));
  assertEquals(await fetchPlaceDetails({ apiKey: 'k', placeId: '../x', language: 'en', fetchImpl }), null);
  assertEquals(seen.length, 1);
});

Deno.test('fetchPhotoUri: skipHttpRedirect ile adres alır, anahtar sadece başlıkta; geçersiz ad reddedilir', async () => {
  const seen: { url: string; headers: Record<string, string> }[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    seen.push({ url, headers: init.headers as Record<string, string> });
    return Promise.resolve(new Response(JSON.stringify({ name: 'x', photoUri: 'https://lh3.googleusercontent.com/abc' }), { status: 200 }));
  }) as unknown as typeof fetch;
  const uri = await fetchPhotoUri({ apiKey: 'secret', photoName: `places/${PLACE_ID}/photos/AUy1`, fetchImpl });
  assertEquals(uri, 'https://lh3.googleusercontent.com/abc');
  assertEquals(seen[0].url, `https://places.googleapis.com/v1/places/${PLACE_ID}/photos/AUy1/media?maxWidthPx=900&skipHttpRedirect=true`);
  assertEquals(seen[0].url.includes('secret'), false);
  assertEquals(seen[0].headers['X-Goog-Api-Key'], 'secret');
  assertEquals(await fetchPhotoUri({ apiKey: 'k', photoName: 'places/../..', fetchImpl }), null);
  const http = (() => Promise.resolve(new Response(JSON.stringify({ photoUri: 'http://insecure/x' }), { status: 200 }))) as unknown as typeof fetch;
  assertEquals(await fetchPhotoUri({ apiKey: 'k', photoName: `places/${PLACE_ID}/photos/AUy1`, fetchImpl: http }), null);
});

Deno.test('openNowRequest: anahtar kelime aramaya eklenir ve istek Google şemasında geçerli kalır', () => {
  const plain = openNowRequest({ lat: 41, lng: 29, category: 'restaurant', language: 'tr' });
  assertEquals(plain.textQuery, 'restaurant');
  const withKeyword = openNowRequest({ lat: 41, lng: 29, category: 'restaurant', language: 'tr', radius: 12_000, keyword: 'vegan' });
  assertEquals(withKeyword.textQuery, 'vegan restaurant');
  assertEquals(withKeyword.locationBias?.circle.radius, 12_000);
  assertEquals(validateObject(GOOGLE_SCHEMA.places.schemas, 'GoogleMapsPlacesV1SearchTextRequest', withKeyword), []);
});

Deno.test('normalizePriceRange: Google fiyat aralığı', async () => {
  const { normalizePriceRange } = await import('./places.ts');
  assertEquals(normalizePriceRange({ startPrice: { currencyCode: 'EUR', units: '15' }, endPrice: { currencyCode: 'EUR', units: '25' } }), { min: 15, max: 25, currency: 'EUR' });
  assertEquals(normalizePriceRange({ startPrice: { currencyCode: 'TRY', units: '300', nanos: 500000000 } }), { min: 300.5, max: null, currency: 'TRY' });
  assertEquals(normalizePriceRange({}), null);
  assertEquals(normalizePriceRange(undefined), null);
});

Deno.test('priceFields: Google aralığı kalemin fiyatı olur, aralık yoksa AI tahmini kalır', async () => {
  const { priceFields, normalizePlace } = await import('./places.ts');
  const withRange = normalizePlace({ id: 'p1', displayName: { text: 'X' }, priceRange: { startPrice: { currencyCode: 'TRY', units: '400' }, endPrice: { currencyCode: 'TRY', units: '1000' } } })!;
  assertEquals(priceFields(withRange), { estimated_cost: 700, cost_currency: 'TRY', cost_min: 400, cost_max: 1000 });
  const onlyMin = normalizePlace({ id: 'p2', displayName: { text: 'Y' }, priceRange: { startPrice: { currencyCode: 'EUR', units: '20' } } })!;
  assertEquals(priceFields(onlyMin), { estimated_cost: 20, cost_currency: 'EUR', cost_min: 20, cost_max: 20 });
  assertEquals(priceFields(normalizePlace({ id: 'p3', displayName: { text: 'Z' } })!), null);
});

Deno.test('pickNearest: zincir şubelerden şehir merkezine en yakını seçilir', async () => {
  const { pickNearest, MAX_DISTANCE_M } = await import('./places.ts');
  const mk = (id: string, lat: number | null, lng: number | null) => ({ id, name: id, address: null, lat, lng }) as unknown as Parameters<typeof pickNearest>[0][number];
  const center = { lat: 41.0082, lng: 28.9784 };
  const gebze = mk('gebze', 40.8, 29.43);
  const karakoy = mk('karakoy', 41.0225, 28.977);
  assertEquals(pickNearest([gebze, karakoy], center)?.id, 'karakoy');
  assertEquals(pickNearest([gebze, karakoy], null)?.id, 'gebze');
  assertEquals(pickNearest([mk('x', null, null), gebze], center)?.id, 'gebze');
  assertEquals(pickNearest([], center), undefined);
  assertEquals(MAX_DISTANCE_M, 30_000);
});
