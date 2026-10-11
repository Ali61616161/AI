import { assertEquals } from 'jsr:@std/assert@1';

import { currentUrl, fetchForecast, forecastUrl, normalizeCurrent, normalizeForecast, weatherForPrompt } from './weather.ts';

const day = (d: number, extra: Record<string, unknown> = {}) => ({
  displayDate: { year: 2026, month: 10, day: d },
  maxTemperature: { degrees: 22.4, unit: 'CELSIUS' },
  minTemperature: { degrees: 14.1, unit: 'CELSIUS' },
  daytimeForecast: {
    weatherCondition: { type: 'LIGHT_RAIN', description: { text: 'Hafif yağmur', languageCode: 'tr' }, iconBaseUri: 'https://maps.gstatic.com/weather/v1/drizzle' },
    precipitation: { probability: { percent: 70, type: 'RAIN' } },
  },
  ...extra,
});

Deno.test('forecastUrl/currentUrl: 1–10 gün aralığına sıkıştırır, metrik birim ister', () => {
  const q = { lat: 41.9, lng: 12.5, language: 'tr', apiKey: 'k' };
  const u = new URL(forecastUrl({ ...q, days: 30 }));
  assertEquals(u.origin + u.pathname, 'https://weather.googleapis.com/v1/forecast/days:lookup');
  assertEquals(u.searchParams.get('days'), '10');
  assertEquals(u.searchParams.get('pageSize'), '10');
  assertEquals(u.searchParams.get('unitsSystem'), 'METRIC');
  assertEquals(new URL(forecastUrl({ ...q, days: 0 })).searchParams.get('days'), '1');
  assertEquals(new URL(currentUrl(q)).pathname, '/v1/currentConditions:lookup');
});

Deno.test('normalizeForecast: günleri tarih, sıcaklık ve yağış olasılığıyla döndürür', () => {
  assertEquals(normalizeForecast({ forecastDays: [day(11), { displayDate: {} }, day(3, { daytimeForecast: {} })] }), [
    { date: '2026-10-11', max: 22.4, min: 14.1, condition: 'LIGHT_RAIN', description: 'Hafif yağmur', iconUri: 'https://maps.gstatic.com/weather/v1/drizzle', rainChance: 70 },
    { date: '2026-10-03', max: 22.4, min: 14.1, condition: null, description: null, iconUri: null, rainChance: null },
  ]);
  assertEquals(normalizeForecast({}), []);
});

Deno.test('normalizeCurrent ve weatherForPrompt: asistana kısa özet', () => {
  const w = normalizeCurrent({
    temperature: { degrees: 9.6 },
    feelsLikeTemperature: { degrees: 6.2 },
    weatherCondition: { type: 'RAIN', description: { text: 'Rain' } },
    precipitation: { probability: { percent: 90 } },
    isDaytime: false,
  });
  assertEquals(weatherForPrompt(w), 'Rain, 10°C, feels like 6°C, 90% chance of rain, dark outside');
  assertEquals(normalizeCurrent({}), null);
  assertEquals(weatherForPrompt(null), null);
});

Deno.test('fetchForecast: HTTP hatasında hata fırlatır', async () => {
  const fetchImpl = (() => Promise.resolve(new Response('denied', { status: 403 }))) as unknown as typeof fetch;
  let message = '';
  await fetchForecast({ lat: 1, lng: 1, days: 3, language: 'en', apiKey: 'k', fetchImpl }).catch((e) => (message = e.message));
  assertEquals(message, 'weather http 403: denied');
});
