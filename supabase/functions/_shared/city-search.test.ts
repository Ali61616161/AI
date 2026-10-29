import { assert, assertEquals } from 'jsr:@std/assert@1';

import { autocompleteBody, cleanQuery, parsePick, parseSuggestions, pickCity, suggestCities } from './city-search.ts';

Deno.test('cleanQuery: kırpar, kontrol karakteri atar, sınırlar', () => {
  assertEquals(cleanQuery('  Roma \n'), 'Roma');
  assertEquals(cleanQuery('a'), null);
  assertEquals(cleanQuery('x'.repeat(61)), null);
  assertEquals(cleanQuery(5), null);
});

Deno.test('autocompleteBody: yalnızca şehirler ve oturum belirteci', () => {
  const b = autocompleteBody('Rom', 'tr', 'abcdefgh12');
  assertEquals(b.includedPrimaryTypes, ['(cities)']);
  assertEquals(b.sessionToken, 'abcdefgh12');
});

Deno.test('parseSuggestions: ad, ayrıntı; bozuk kayıtlar atlanır; en çok 6', () => {
  const body = {
    suggestions: [
      { placePrediction: { placeId: 'ChIJu46S-ZZhLxMROG5lkwZ3D7k', structuredFormat: { mainText: { text: 'Roma' }, secondaryText: { text: 'Lazio, İtalya' } } } },
      { placePrediction: { placeId: 'kısa', text: { text: 'X' } } },
      { placePrediction: { placeId: 'ChIJAAAAAAAAAAAAAAAAAAAA', text: { text: 'Fallback City, Land' } } },
      {},
    ],
  };
  const out = parseSuggestions(body);
  assertEquals(out.length, 2);
  assertEquals(out[0], { place_id: 'ChIJu46S-ZZhLxMROG5lkwZ3D7k', name: 'Roma', detail: 'Lazio, İtalya' });
  assertEquals(out[1].name, 'Fallback City, Land');
  assertEquals(parseSuggestions(null), []);
});

Deno.test('parsePick: ülke kodu yoksa null', () => {
  const ok = parsePick({ displayName: { text: 'Roma' }, addressComponents: [{ types: ['locality'], shortText: 'Roma' }, { types: ['country', 'political'], shortText: 'it' }], location: { latitude: 41.9, longitude: 12.5 } });
  assertEquals(ok, { name: 'Roma', country_code: 'IT', lat: 41.9, lng: 12.5 });
  assertEquals(parsePick({ displayName: { text: 'X' }, addressComponents: [] }), null);
  assertEquals(parsePick({ displayName: { text: 'X' }, addressComponents: [{ types: ['country'], shortText: 'ITA' }] }), null);
});

Deno.test('suggestCities/pickCity: istek biçimi ve hata', async () => {
  let seen: { url: string; init?: RequestInit } | undefined;
  const fetchImpl = ((url: string, init?: RequestInit) => {
    seen = { url, init };
    return Promise.resolve(new Response(JSON.stringify({ suggestions: [{ placePrediction: { placeId: 'ChIJu46S-ZZhLxMROG5lkwZ3D7k', text: { text: 'Roma' } } }] })));
  }) as typeof fetch;
  const list = await suggestCities({ apiKey: 'K', input: 'Rom', language: 'tr', sessionToken: 'abcdefgh12', fetchImpl });
  assertEquals(list.length, 1);
  assert(seen!.url.endsWith('/v1/places:autocomplete'));
  assertEquals(new Headers(seen!.init?.headers).get('x-goog-api-key'), 'K');

  const pick = await pickCity({
    apiKey: 'K',
    placeId: 'ChIJu46S-ZZhLxMROG5lkwZ3D7k',
    language: 'tr',
    sessionToken: 'abcdefgh12',
    fetchImpl: (() => Promise.resolve(new Response(JSON.stringify({ displayName: { text: 'Roma' }, addressComponents: [{ types: ['country'], shortText: 'IT' }] })))) as typeof fetch,
  });
  assertEquals(pick?.country_code, 'IT');
  assertEquals(await pickCity({ apiKey: 'K', placeId: '../x', language: 'tr', sessionToken: 'abcdefgh12', fetchImpl }), null);

  let threw = false;
  await suggestCities({ apiKey: 'K', input: 'Rom', language: 'tr', sessionToken: 'abcdefgh12', fetchImpl: (() => Promise.resolve(new Response('no', { status: 403 }))) as typeof fetch }).catch(() => (threw = true));
  assert(threw);
});
