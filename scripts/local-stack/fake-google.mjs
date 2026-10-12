#!/usr/bin/env node
// Google Places (Text Search), Weather, Cloud Translation ve RevenueCat REST API'nin TEST İKİZİ. Gerçek Google gibi
// isteği resmi şemayla doğrular (bilinmeyen alan → 400 INVALID_ARGUMENT) ve Roma
// civarında öngörülebilir mekanlar ve yağmurlu hava döndürür. Edge Function'ların
// harita/mekan/hava yolunu gerçek anahtar olmadan uçtan uca test etmek içindir.
// Uygulamada ve gerçek ortamda KULLANILMAZ.
import crypto from 'node:crypto';
import { readFileSync } from 'node:fs';
import http from 'node:http';

const PORT = Number(process.env.FAKE_GOOGLE_PORT ?? 54341);
const schema = JSON.parse(readFileSync(new URL('../../supabase/functions/_shared/google/schema.json', import.meta.url), 'utf8'));
const calls = [];
// RevenueCat REST test ikizi: testler abone verisini POST /__rc/subscribers/<id> ile yazar.
const rcSubscribers = new Map();
const ROME = { latitude: 41.9028, longitude: 12.4964 };

function validate(schemas, name, value, path = '') {
  const props = schemas[name];
  if (!props || !value || typeof value !== 'object' || Array.isArray(value)) return [`${path || name}: expected object`];
  const errors = [];
  for (const [key, v] of Object.entries(value)) {
    const at = path ? `${path}.${key}` : key;
    if (!(key in props)) {
      errors.push(`Unknown name "${at}"`);
      continue;
    }
    const prop = props[key];
    for (const x of Array.isArray(v) ? v : [v]) {
      if (prop && typeof prop === 'object' && !prop.enum.includes(String(x))) errors.push(`Invalid value at "${at}" (${x})`);
      if (typeof prop === 'string') errors.push(...validate(schemas, prop, x, at));
    }
  }
  return errors;
}

function validMask(mask) {
  const s = schema.places.schemas;
  return mask.split(',').every((path) => {
    let current = 'GoogleMapsPlacesV1SearchTextResponse';
    for (const part of path.split('.')) {
      if (!current || !s[current] || !(part in s[current])) return false;
      current = typeof s[current][part] === 'string' ? s[current][part] : null;
    }
    return true;
  });
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const place = (name, i, extra = {}) => ({
  id: `fake-${slug(name)}`,
  displayName: { text: name, languageCode: 'en' },
  formattedAddress: `Via Test ${i + 1}, 00100 Roma RM, Italy`,
  shortFormattedAddress: `Via Test ${i + 1}, Roma`,
  location: { latitude: ROME.latitude + 0.002 * (i + 1), longitude: ROME.longitude + 0.001 * (i + 1) },
  rating: 4.5 - i * 0.1,
  userRatingCount: 1000 + i,
  googleMapsUri: `https://maps.google.com/?cid=${slug(name)}`,
  businessStatus: 'OPERATIONAL',
  ...extra,
});

function searchText(body) {
  if (body.includedType === 'locality') return { places: [{ id: 'fake-city', displayName: { text: 'Rome' }, location: ROME }] };
  if (body.includedType === 'lodging') return { places: ['TEST Hotel Centro', 'TEST Hotel Stazione', 'TEST Hotel Closed'].map((n, i) => place(n, i, i === 2 ? { businessStatus: 'CLOSED_PERMANENTLY' } : {})) };
  if (body.openNow) {
    return {
      places: [1, 2, 3].map((n, i) => place(`TEST open ${body.includedType} ${n}`, i, { currentOpeningHours: { openNow: n !== 3 } })),
    };
  }
  const name = body.textQuery.split(',')[0].trim();
  if (name.includes('Nowhere')) return {};
  return { places: [place(name, 0, { rating: 4.6 })] };
}

function weatherDays(days) {
  return {
    forecastDays: Array.from({ length: days }, (_, i) => {
      const d = new Date(Date.now() + i * 86_400_000);
      return {
        displayDate: { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() },
        maxTemperature: { degrees: 20 + i, unit: 'CELSIUS' },
        minTemperature: { degrees: 12 + i, unit: 'CELSIUS' },
        daytimeForecast: {
          weatherCondition: { type: i === 0 ? 'RAIN' : 'PARTLY_CLOUDY', description: { text: i === 0 ? 'TEST rain' : 'TEST partly cloudy' } },
          precipitation: { probability: { percent: i === 0 ? 80 : 10, type: 'RAIN' } },
        },
      };
    }),
  };
}

function send(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

// AdMob ödüllü reklam doğrulaması (SSV): gerçek Google gibi ECDSA P-256 ile imzalar.
const admobKeys = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
const ADMOB_KEY_ID = 3335741209;

http
  .createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === '/calls') return send(res, 200, calls);
    if (url.pathname === '/__admob/keys') {
      const spki = admobKeys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
      return send(res, 200, { keys: [{ keyId: ADMOB_KEY_ID, pem: '', base64: spki }] });
    }
    if (url.pathname === '/__admob/sign') {
      // Test: verilen sorguyu imzalar ve Google'ın göndereceği tam sorguyu döner.
      const query = url.searchParams.get('query') ?? '';
      const signature = crypto.sign('sha256', Buffer.from(query), admobKeys.privateKey).toString('base64url');
      return send(res, 200, { query: `${query}&signature=${signature}&key_id=${ADMOB_KEY_ID}` });
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);

    const rc = /^\/(__rc|v1)\/subscribers\/([^/]+)$/.exec(url.pathname);
    if (rc && rc[1] === '__rc' && req.method === 'POST') {
      rcSubscribers.set(decodeURIComponent(rc[2]), JSON.parse(Buffer.concat(chunks).toString() || '{}'));
      return send(res, 200, { ok: true });
    }
    if (rc && rc[1] === 'v1' && req.method === 'GET') {
      if (req.headers.authorization !== 'Bearer test-rc-secret') return send(res, 401, { message: 'invalid key' });
      const id = decodeURIComponent(rc[2]);
      return send(res, 200, { subscriber: { original_app_user_id: id, subscriptions: {}, non_subscriptions: {}, ...(rcSubscribers.get(id) ?? {}) } });
    }

    if (req.method === 'POST' && url.pathname === '/v1/places:searchText') {
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const mask = req.headers['x-goog-fieldmask'] ?? '';
      const errors = validate(schema.places.schemas, 'GoogleMapsPlacesV1SearchTextRequest', body);
      if (!req.headers['x-goog-api-key']) errors.push('API key missing');
      if (!mask || !validMask(mask)) errors.push(`Invalid field mask: ${mask}`);
      calls.push({ api: 'places', body, errors });
      if (errors.length) return send(res, 400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: errors.join('; ') } });
      return send(res, 200, searchText(body));
    }

    if (req.method === 'POST' && url.pathname === `/${schema.translate.servicePath}v2`) {
      const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
      const errors = validate(schema.translate.schemas, 'TranslateTextRequest', body);
      if (!req.headers['x-goog-api-key']) errors.push('API key missing');
      calls.push({ api: 'translate', body, errors });
      if (errors.length) return send(res, 400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: errors.join('; ') } });
      // Gerçek v2 API'si gibi "data" sarmalıyla döner.
      return send(res, 200, {
        data: { translations: body.q.map((q) => ({ translatedText: `[${body.target}] ${q}`, ...(body.source ? {} : { detectedSourceLanguage: 'tr' }) })) },
      });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/v1/')) {
      const method = url.pathname.slice(1);
      const allowed = schema.weather.methods[method];
      const unknown = allowed ? [...url.searchParams.keys()].filter((k) => k !== 'key' && !allowed.includes(k)) : ['method'];
      calls.push({ api: method, params: Object.fromEntries(url.searchParams), errors: unknown });
      if (!url.searchParams.get('key') || unknown.length) return send(res, 400, { error: { code: 400, status: 'INVALID_ARGUMENT', message: `bad request: ${unknown}` } });
      if (method === 'v1/forecast/days:lookup') return send(res, 200, weatherDays(Number(url.searchParams.get('days') ?? 5)));
      if (method === 'v1/currentConditions:lookup') {
        return send(res, 200, {
          temperature: { degrees: 12.4 },
          feelsLikeTemperature: { degrees: 10.1 },
          weatherCondition: { type: 'RAIN', description: { text: 'TEST rain' } },
          precipitation: { probability: { percent: 85 } },
          isDaytime: true,
        });
      }
    }
    send(res, 404, { error: { code: 404, message: 'not found' } });
  })
  .listen(PORT, () => console.log(`fake google :${PORT}`));
