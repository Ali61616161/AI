import { assertEquals, assertNotEquals } from 'jsr:@std/assert@1';

import { derToP1363, verifySsv } from './admob-ssv.ts';

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b));
const toB64Url = (b: Uint8Array) => toB64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** r||s imzasını DER'e çevirir (Google imzaları DER gönderir). */
function p1363ToDer(sig: Uint8Array): Uint8Array {
  const int = (b: Uint8Array) => {
    let i = 0;
    while (i < b.length - 1 && b[i] === 0) i++;
    let v = b.slice(i);
    if (v[0] & 0x80) v = Uint8Array.of(0, ...v);
    return Uint8Array.of(0x02, v.length, ...v);
  };
  const body = Uint8Array.of(...int(sig.slice(0, 32)), ...int(sig.slice(32)));
  return Uint8Array.of(0x30, body.length, ...body);
}

async function signed(query: string, keyId = 3335741209) {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey));
  const raw = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(query)));
  return { url: `${query}&signature=${toB64Url(p1363ToDer(raw))}&key_id=${keyId}`, keys: [{ keyId, base64: toB64(spki) }] };
}

const NOW = 1_791_000_000_000;
const U = '6f1c7e7a-2b1e-4c55-9a51-1c2d3e4f5a6b';
const base = `ad_network=5450213213286189855&ad_unit=1234&custom_data=nearby_search&reward_amount=1&reward_item=hak&timestamp=${NOW}&transaction_id=tx123&user_id=${U}`;

Deno.test('derToP1363: DER imza 64 bayta çevrilir', () => {
  const raw = new Uint8Array(64).map((_, i) => (i === 0 ? 0x80 : i));
  assertEquals(derToP1363(p1363ToDer(raw)), raw);
});

Deno.test('verifySsv: geçerli imza kabul, değiştirilmiş veri reddedilir', async () => {
  const { url, keys } = await signed(base);
  const ok = await verifySsv(url, keys, NOW);
  assertEquals(ok, { userId: U, customData: 'nearby_search', transactionId: 'tx123', keyId: 3335741209, timestamp: NOW });
  assertEquals(await verifySsv(url.replace('nearby_search', 'travel_info'), keys, NOW), null, 'veri değişince imza tutmamalı');
  assertEquals(await verifySsv(url.replace(`user_id=${U}`, 'user_id=someone-else'), keys, NOW), null);
});

Deno.test('verifySsv: bilinmeyen anahtar, eski istek ve imzasız istek reddedilir', async () => {
  const { url, keys } = await signed(base);
  assertEquals(await verifySsv(url, [{ keyId: 1, base64: keys[0].base64 }], NOW), null);
  assertEquals(await verifySsv(url, keys, NOW + 2 * 60 * 60_000), null);
  assertEquals(await verifySsv(base, keys, NOW), null);
  assertNotEquals(await verifySsv(`?${url}`, keys, NOW), null, 'baştaki ? kabul edilir');
});
