import { assertEquals } from 'jsr:@std/assert@1';

import { aviasalesUrl, buildDealsUrl, fetchDeals, isIata, lookupCity, parseDeals } from './deals.ts';

const row = (destination: string, price: number | string, extra: Record<string, unknown> = {}) => ({ destination, price, departure_at: '2026-12-13T08:40:00+03:00', return_at: '2026-12-17T10:00:00+01:00', airline: 'tk', ...extra });

Deno.test('buildDealsUrl: kalkış, para birimi ve her yön bir kez', () => {
  const u = new URL(buildDealsUrl('IST', 'EUR'));
  assertEquals(u.searchParams.get('origin'), 'IST');
  assertEquals(u.searchParams.get('currency'), 'eur');
  assertEquals(u.searchParams.get('unique'), 'true');
  assertEquals(u.searchParams.get('sorting'), 'price');
  assertEquals(u.searchParams.get('destination'), null);
});

Deno.test('parseDeals: geçersiz satırlar elenir, yönler tekilleşir, en ucuzdan sıralanır', () => {
  const body = { data: [row('ROM', 120), row('ROM', 77), row('IST', 10), row('xx', 50), row('PRG', 0), row('PRG', 64, { airline: 'PC' }), row('ATH', 59, { return_at: null }), { destination: 'BER', price: 40 }, row('LON', 'abc')] };
  const deals = parseDeals(body, 'IST');
  assertEquals(deals.map((d) => d.destination), ['ATH', 'PRG', 'ROM']);
  assertEquals(deals[2], { destination: 'ROM', price: 77, departOn: '2026-12-13', returnOn: '2026-12-17', airline: 'TK' });
  assertEquals(deals[0].returnOn, null);
  assertEquals(parseDeals(null, 'IST'), []);
  assertEquals(parseDeals({ data: 'x' }, 'IST'), []);
});

Deno.test('parseDeals: en çok 10 fırsat', () => {
  const codes = 'ABCDEFGHIJKLMNOP'.split('').map((c) => `${c}AA`);
  assertEquals(parseDeals({ data: codes.map((c, i) => row(c, 100 + i)) }, 'IST').length, 10);
});

Deno.test('aviasalesUrl: gün-ay biçimi, dönüş ve ortak numarası', () => {
  assertEquals(aviasalesUrl({ origin: 'IST', destination: 'ROM', departOn: '2026-12-13', returnOn: '2026-12-17' }), 'https://www.aviasales.com/search/IST1312ROM17121');
  assertEquals(aviasalesUrl({ origin: 'IST', destination: 'ROM', departOn: '2026-12-13', returnOn: null, marker: '123456' }), 'https://www.aviasales.com/search/IST1312ROM1?marker=123456');
  // şüpheli marker eklenmez
  assertEquals(aviasalesUrl({ origin: 'IST', destination: 'ROM', departOn: '2026-12-13', returnOn: null, marker: 'a&b=c' }), 'https://www.aviasales.com/search/IST1312ROM1');
});

Deno.test('fetchDeals: belirteç başlığı ve hata', async () => {
  let seen: Headers | null = null;
  const ok = ((_u: unknown, init?: RequestInit) => {
    seen = new Headers(init?.headers);
    return Promise.resolve(new Response(JSON.stringify({ data: [row('ROM', 77)] })));
  }) as typeof fetch;
  assertEquals((await fetchDeals('tok', 'IST', 'EUR', ok)).length, 1);
  assertEquals(seen!.get('x-access-token'), 'tok');
  const bad = (() => Promise.resolve(new Response('no', { status: 401 }))) as typeof fetch;
  let failed = false;
  await fetchDeals('tok', 'IST', 'EUR', bad).catch(() => (failed = true));
  assertEquals(failed, true);
});

Deno.test('lookupCity: kod tam eşleşmesi, ad araması, geçersiz girdi', async () => {
  const rows = [{ type: 'airport', code: 'FCO', name: 'Fiumicino' }, { type: 'city', code: 'ROM', name: 'Roma', country_code: 'IT' }, { type: 'city', code: 'RMG', name: 'Rome', country_code: 'US' }];
  const f = (() => Promise.resolve(new Response(JSON.stringify(rows)))) as typeof fetch;
  assertEquals(await lookupCity('Roma', 'tr', f), { code: 'ROM', name: 'Roma', countryCode: 'IT' });
  assertEquals((await lookupCity('RMG', 'en', f))?.code, 'RMG');
  assertEquals(await lookupCity('a', 'en', f), null);
  assertEquals(await lookupCity('Roma', 'en', (() => Promise.resolve(new Response('x', { status: 500 }))) as typeof fetch), null);
  assertEquals(isIata('IST'), true);
  assertEquals(isIata('ist'), false);
});
