import { assert, assertEquals } from 'jsr:@std/assert@1';

import { accessFor, bestAccess, hasPassportData, passportPower, SCHENGEN } from './visa-access.ts';
import type { UnlockRule } from './visa-unlocks.ts';

Deno.test('pasaport verisi: kendi ülkesi, vizesiz ve vize gerekli', () => {
  assertEquals(accessFor('TR', 'TR')?.status, 'own');
  assertEquals(accessFor('TR', 'GE'), { status: 'visa_free', days: 360 });
  assertEquals(accessFor('TR', 'DE')?.status, 'visa_required');
  assertEquals(accessFor('XX', 'DE'), null);
  assert(hasPassportData('TR'));
  assert(!hasPassportData('XX'));
});

Deno.test('birden fazla pasaport: en kolay giriş seçilir', () => {
  const a = bestAccess(['TR', 'DE'], [], 'FR');
  assertEquals(a?.status, 'visa_free');
  assertEquals(a?.via, { kind: 'passport', code: 'DE' });
});

Deno.test('Schengen vizesi Schengen ülkelerini açar, diğerlerini açmaz', () => {
  assertEquals(bestAccess(['TR'], ['schengen_visa'], 'FR')?.status, 'visa_free');
  assertEquals(bestAccess(['TR'], ['schengen_visa'], 'FR')?.via.kind, 'visa');
  assertEquals(bestAccess(['TR'], ['schengen_visa'], 'US')?.status, 'visa_required');
  assertEquals(SCHENGEN.length, 29);
});

Deno.test('kural: sadece daha kolaysa ve uyruk şartı tutuyorsa uygulanır', () => {
  const rules: UnlockRule[] = [
    { holder: 'us_visa', destination: 'GB', effect: 'visa_free', max_days: 30, condition: 'test', nationalities: ['IN'], source: 'https://example.gov' },
    { holder: 'us_visa', destination: 'IE', effect: 'evisa', max_days: null, condition: null, nationalities: null, source: 'https://example.gov' },
  ];
  assertEquals(bestAccess(['TR'], ['us_visa'], 'GB', rules)?.status, 'visa_required');
  assertEquals(bestAccess(['IN'], ['us_visa'], 'GB', rules)?.status, 'visa_free');
  // Zaten vizesiz gidilen yerde kural pasaportu geçersiz kılmaz.
  assertEquals(bestAccess(['DE'], ['us_visa'], 'IE', rules)?.via, { kind: 'passport', code: 'DE' });
});

Deno.test('pasaport gücü: puan, sıra ve ek vizelerle açılanlar', () => {
  const tr = passportPower(['TR']);
  assert(tr && tr.score > 50 && tr.score < 198);
  assertEquals(tr.unlocked, 0);
  assert(tr.rank !== null && tr.rank > 1);
  const withVisa = passportPower(['TR'], ['schengen_visa']);
  assert(withVisa && withVisa.score >= tr.score + 25 && withVisa.unlocked >= 25);
  const de = passportPower(['DE']);
  assert(de && de.score > tr.score && de.rank! < tr.rank!);
  assertEquals(passportPower([]), null);
});

Deno.test('süresi biten geçici kural uygulanmaz', () => {
  const rules: UnlockRule[] = [
    { holder: 'us_visa', destination: 'IE', effect: 'visa_free', max_days: 90, condition: null, nationalities: null, source: 'https://example.gov', valid_until: '2026-10-31' },
  ];
  assertEquals(bestAccess(['IN'], ['us_visa'], 'IE', rules, '2026-10-30')?.status, 'visa_free');
  assertEquals(bestAccess(['IN'], ['us_visa'], 'IE', rules, '2026-11-01')?.status, accessFor('IN', 'IE')?.status);
});
