import { assert, assertEquals } from 'jsr:@std/assert@1';

import { alertMessage, appendPoint, buildQueryUrl, fetchCheapest, parseCheapest, shouldAlert } from './price-watch.ts';

Deno.test('parseCheapest: en ucuz fiyat ve havayolu; bozuk satırlar atlanır', () => {
  const body = { success: true, data: [{ price: 210.5, airline: 'tk' }, { price: 'x' }, { price: 180, airline: 'PC' }, { price: -3 }, null] };
  assertEquals(parseCheapest(body), { price: 180, airline: 'PC' });
  assertEquals(parseCheapest({ data: [{ price: 99, airline: '<script>' }] }), { price: 99, airline: null });
  assertEquals(parseCheapest({ data: [] }), null);
  assertEquals(parseCheapest({ error: 'x' }), null);
  assertEquals(parseCheapest(null), null);
});

Deno.test('buildQueryUrl: tek yön, gidiş-dönüş ve esnek ay', () => {
  const base = { origin: 'IST', destination: 'ROM', departOn: '2026-12-05', returnOn: null, flexibleMonth: false, currency: 'EUR' };
  const one = new URL(buildQueryUrl(base));
  assertEquals(one.searchParams.get('departure_at'), '2026-12-05');
  assertEquals(one.searchParams.get('one_way'), 'true');
  assertEquals(one.searchParams.get('currency'), 'eur');
  assertEquals(one.searchParams.get('return_at'), null);
  const round = new URL(buildQueryUrl({ ...base, returnOn: '2026-12-12', flexibleMonth: true }));
  assertEquals(round.searchParams.get('departure_at'), '2026-12');
  assertEquals(round.searchParams.get('return_at'), '2026-12');
  assertEquals(round.searchParams.get('one_way'), 'false');
});

Deno.test('fetchCheapest: anahtar başlıkta gider, HTTP hatası fırlatır', async () => {
  let seen: Headers | undefined;
  const ok = await fetchCheapest('TOK', { origin: 'IST', destination: 'ROM', departOn: '2026-12-05', returnOn: null, flexibleMonth: false, currency: 'EUR' }, (_u, init) => {
    seen = new Headers(init?.headers);
    return Promise.resolve(new Response(JSON.stringify({ data: [{ price: 150, airline: 'TK' }] })));
  });
  assertEquals(ok, { price: 150, airline: 'TK' });
  assertEquals(seen?.get('x-access-token'), 'TOK');
  let threw = false;
  await fetchCheapest('TOK', { origin: 'IST', destination: 'ROM', departOn: '2026-12-05', returnOn: null, flexibleMonth: false, currency: 'EUR' }, () => Promise.resolve(new Response('no', { status: 401 }))).catch(() => (threw = true));
  assert(threw);
});

Deno.test('shouldAlert: hedefli ve hedefsiz kararlar, tekrar bildirimi yok', () => {
  assertEquals(shouldAlert({ price: 100, target: 120, previous: 150, lastAlert: null }), true);
  assertEquals(shouldAlert({ price: 130, target: 120, previous: 150, lastAlert: null }), false);
  assertEquals(shouldAlert({ price: 100, target: 120, previous: 100, lastAlert: 100 }), false);
  assertEquals(shouldAlert({ price: 94, target: 120, previous: 100, lastAlert: 100 }), true);
  assertEquals(shouldAlert({ price: 90, target: null, previous: 100, lastAlert: null }), true);
  assertEquals(shouldAlert({ price: 95, target: null, previous: 100, lastAlert: null }), false);
  assertEquals(shouldAlert({ price: 90, target: null, previous: null, lastAlert: null }), false);
});

Deno.test('appendPoint: günde tek nokta, en çok 30', () => {
  assertEquals(appendPoint([{ d: '2026-11-01', p: 100 }], '2026-11-01', 90), [{ d: '2026-11-01', p: 90 }]);
  const many = Array.from({ length: 40 }, (_, i) => ({ d: `2026-01-${String(i + 1).padStart(2, '0')}`, p: i }));
  const out = appendPoint(many, '2026-12-01', 5);
  assertEquals(out.length, 30);
  assertEquals(out[out.length - 1], { d: '2026-12-01', p: 5 });
  assertEquals(appendPoint('garbage', '2026-12-01', 5), [{ d: '2026-12-01', p: 5 }]);
});

Deno.test('alertMessage: dile göre metin, bilinmeyen dil İngilizce', () => {
  const m = alertMessage('tr', { origin: 'IST', destination: 'ROM', price: 99, target: 120, currency: 'EUR' });
  assert(m.title.includes('IST → ROM') && m.title.includes('düştü'));
  assert(m.body.includes('99') && m.body.includes('120'));
  assert(alertMessage('xx', { origin: 'IST', destination: 'ROM', price: 99, target: null, currency: 'USD' }).title.includes('dropped'));
});
