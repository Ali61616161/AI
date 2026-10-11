// Google'a gönderdiğimiz her alanın ve yanıttan okuduğumuz her alanın resmi
// discovery şemasında olduğunu doğrular (google/schema.json).
import { assert, assertEquals } from 'jsr:@std/assert@1';

import { GOOGLE_SCHEMA, validateObject, validatePath, validateWeatherUrl } from './google/validate.ts';
import { cityRequest, hotelRequest, NEARBY_CATEGORIES, openNowRequest, PLACE_FIELDS, SEARCH_TEXT_PATH, verifyRequest, type NearbyCategory } from './places.ts';
import { currentUrl, forecastUrl } from './weather.ts';

const P = GOOGLE_SCHEMA.places.schemas;
const W = GOOGLE_SCHEMA.weather.schemas;

Deno.test('Places: searchText yolu resmi şemada var', () => {
  assert(SEARCH_TEXT_PATH in GOOGLE_SCHEMA.places.methods);
});

Deno.test('Places: tüm istek gövdeleri SearchTextRequest şemasına uyar', () => {
  const bodies = [
    ...(Object.keys(NEARBY_CATEGORIES) as NearbyCategory[]).map((category) => openNowRequest({ lat: 41.9, lng: 12.5, category, language: 'tr' })),
    ...['low', 'mid', 'lux'].map((budget) => hotelRequest({ city: 'Roma', budget, language: 'en', lat: 41.9, lng: 12.5 })),
    hotelRequest({ city: 'Roma', budget: 'mid', language: 'en' }),
    verifyRequest({ placeName: 'Musei Vaticani', city: 'Roma', language: 'it', near: { lat: 41.9, lng: 12.5 } }),
    cityRequest('Roma, IT', 'en'),
  ];
  for (const body of bodies) assertEquals(validateObject(P, 'GoogleMapsPlacesV1SearchTextRequest', body), [], JSON.stringify(body));
});

Deno.test('Places: doğrulayıcı bilinmeyen alanı ve geçersiz enumu yakalar', () => {
  assertEquals(validateObject(P, 'GoogleMapsPlacesV1SearchTextRequest', { textQuery: 'x', openNowOnly: true }), ['openNowOnly: unknown field']);
  assertEquals(validateObject(P, 'GoogleMapsPlacesV1SearchTextRequest', { textQuery: 'x', rankPreference: 'NEAREST' }), ['rankPreference: invalid enum value NEAREST']);
  assertEquals(validateObject(P, 'GoogleMapsPlacesV1SearchTextRequest', { textQuery: 'x', locationBias: { circle: { centre: {} } } }), [
    'locationBias.circle.centre: unknown field',
  ]);
});

Deno.test('Places: alan maskesindeki her yol Place şemasında var', () => {
  for (const field of PLACE_FIELDS) assertEquals(validatePath(P, 'GoogleMapsPlacesV1SearchTextResponse', `places.${field}`), null);
  assert(validatePath(P, 'GoogleMapsPlacesV1SearchTextResponse', 'places.openNow') !== null);
});

Deno.test('Places: normalizePlace\'in okuduğu alt alanlar şemada var', () => {
  for (const path of ['places.displayName.text', 'places.location.latitude', 'places.location.longitude', 'places.currentOpeningHours.openNow']) {
    assertEquals(validatePath(P, 'GoogleMapsPlacesV1SearchTextResponse', path), null);
  }
  const status = P.GoogleMapsPlacesV1Place.businessStatus as { enum: string[] };
  assert(status.enum.includes('CLOSED_PERMANENTLY') && status.enum.includes('CLOSED_TEMPORARILY'));
  const price = P.GoogleMapsPlacesV1Place.priceLevel as { enum: string[] };
  for (const p of ['PRICE_LEVEL_FREE', 'PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE', 'PRICE_LEVEL_EXPENSIVE', 'PRICE_LEVEL_VERY_EXPENSIVE']) assert(price.enum.includes(p));
});

Deno.test('Weather: istek adresleri ve parametreleri şemaya uyar', () => {
  const q = { lat: 41.9, lng: 12.5, language: 'tr', apiKey: 'k' };
  assertEquals(validateWeatherUrl(forecastUrl({ ...q, days: 7 })), []);
  assertEquals(validateWeatherUrl(currentUrl(q)), []);
  assertEquals(validateWeatherUrl('https://weather.googleapis.com/v1/forecast/days:lookup?location.lat=1'), ['location.lat: unknown query parameter']);
});

Deno.test('Weather: okunan yanıt alanları şemada var', () => {
  const forecast = [
    'forecastDays.displayDate.year',
    'forecastDays.displayDate.month',
    'forecastDays.displayDate.day',
    'forecastDays.maxTemperature.degrees',
    'forecastDays.minTemperature.degrees',
    'forecastDays.daytimeForecast.weatherCondition.type',
    'forecastDays.daytimeForecast.weatherCondition.description.text',
    'forecastDays.daytimeForecast.weatherCondition.iconBaseUri',
    'forecastDays.daytimeForecast.precipitation.probability.percent',
  ];
  for (const path of forecast) assertEquals(validatePath(W, 'LookupForecastDaysResponse', path), null);
  const current = [
    'temperature.degrees',
    'feelsLikeTemperature.degrees',
    'weatherCondition.type',
    'weatherCondition.description.text',
    'precipitation.probability.percent',
    'isDaytime',
  ];
  for (const path of current) assertEquals(validatePath(W, 'LookupCurrentConditionsResponse', path), null);
});
