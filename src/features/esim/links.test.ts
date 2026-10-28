import assert from 'node:assert/strict';
import { test } from 'node:test';

import { esimOptions, esimSlug } from './links.ts';

test('ülke adı sağlayıcı adres parçasına çevrilir', () => {
  assert.equal(esimSlug('JP'), 'japan');
  assert.equal(esimSlug('GB'), 'united-kingdom');
  assert.equal(esimSlug('KR'), 'south-korea');
  assert.equal(esimSlug('TR'), 'turkey');
  assert.equal(esimSlug('CZ'), 'czech-republic');
  assert.equal(esimSlug('AE'), 'united-arab-emirates');
  assert.equal(esimSlug('ZZ'), null);
});

test('şablonsuz düz sağlayıcı sayfaları; bilinmeyen ülkede ana sayfa', () => {
  const [airalo, holafly, saily] = esimOptions('JP');
  assert.deepEqual([airalo.url, holafly.url, saily.url], ['https://www.airalo.com/japan-esim', 'https://esim.holafly.com/esim-japan/', 'https://saily.com/esim-japan/']);
  assert.ok([airalo, holafly, saily].every((o) => !o.affiliate));
  assert.equal(esimOptions('ZZ')[0].url, 'https://www.airalo.com/');
});

test('geçerli ortaklık şablonu hedef adresi sarar; https olmayan veya {url} içermeyen yok sayılır', () => {
  const [airalo, holafly, saily] = esimOptions('JP', {
    airalo: 'https://airalo.pxf.io/c/1/2/3?u={url}',
    holafly: 'http://evil.example/?u={url}',
    saily: 'https://saily.example/?x=1',
  });
  assert.equal(airalo.url, 'https://airalo.pxf.io/c/1/2/3?u=https%3A%2F%2Fwww.airalo.com%2Fjapan-esim');
  assert.equal(airalo.affiliate, true);
  assert.equal(holafly.affiliate, false);
  assert.equal(saily.affiliate, false);
});
