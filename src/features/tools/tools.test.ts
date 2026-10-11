import { assert, assertEquals } from 'jsr:@std/assert@1';

import { EMERGENCY_NUMBERS, emergencyNumbersFor, flag } from './emergency-numbers.ts';
import { jetLagPlan, offsetHours } from './jetlag.ts';
import { suggestPacking, type PackingInput } from './packing.ts';
import { balances, equalShares, settle } from './settle.ts';

Deno.test('Acil numaralar: her ülkede en az bir aranabilir numara, sadece rakam', () => {
  for (const [code, n] of Object.entries(EMERGENCY_NUMBERS)) {
    assert(/^[A-Z]{2}$/.test(code), code);
    const values = Object.values(n);
    assert(values.length > 0 && (n.general || n.police), `${code}: genel veya polis numarası olmalı`);
    for (const v of values) assert(/^\d{2,5}$/.test(v!), `${code}: ${v}`);
  }
  assertEquals(emergencyNumbersFor('it')?.general, '112');
  assertEquals(emergencyNumbersFor('US')?.general, '911');
  assertEquals(emergencyNumbersFor('JP')?.ambulance, '119');
  assertEquals(emergencyNumbersFor('XX'), null);
  assertEquals(flag('tr'), '🇹🇷');
});

Deno.test('equalShares: kuruşlar kaybolmadan bölünür', () => {
  assertEquals(equalShares(100, ['A', 'B', 'C']), [
    { name: 'A', amount: 33.34 },
    { name: 'B', amount: 33.33 },
    { name: 'C', amount: 33.33 },
  ]);
  assertEquals(equalShares(10, []), []);
});

Deno.test('settle: bakiyeler sıfırlanır, en az transfer', () => {
  const expenses = [
    { paidBy: 'Ali', amount: 90, shares: equalShares(90, ['Ali', 'Bea', 'Can']) },
    { paidBy: 'Bea', amount: 30, shares: equalShares(30, ['Ali', 'Bea', 'Can']) },
  ];
  assertEquals(balances(expenses), { Ali: 50, Bea: -10, Can: -40 });
  assertEquals(settle(expenses), [
    { from: 'Can', to: 'Ali', amount: 40 },
    { from: 'Bea', to: 'Ali', amount: 10 },
  ]);
  assertEquals(settle([{ paidBy: 'Ali', amount: 20, shares: [{ name: 'Ali', amount: 20 }] }]), []);
  // Yuvarlama artıkları transfer üretmez.
  const odd = [{ paidBy: 'A', amount: 10, shares: equalShares(10, ['A', 'B', 'C']) }];
  const t = settle(odd);
  assertEquals(t.reduce((s, x) => s + x.amount, 0), 6.66);
});

const base: PackingInput = { nights: 4, minTemp: 14, maxTemp: 22, rainChance: 10, companion: 'solo', children: 0, interests: [], hasOutdoor: false, hasFlight: true, international: true };
const keys = (i: PackingInput) => suggestPacking(i).map((x) => x.key);

Deno.test('suggestPacking: hava, süre ve yol arkadaşına göre', () => {
  assert(keys(base).includes('passport') && keys(base).includes('plugAdapter') && keys(base).includes('lightJacket'));
  assert(!keys(base).includes('umbrella') && !keys(base).includes('warmJacket'));
  assert(keys({ ...base, rainChance: 70 }).includes('umbrella'));
  assert(keys({ ...base, minTemp: 0 }).includes('hatGloves'));
  assert(keys({ ...base, maxTemp: 31 }).includes('sunscreen'));
  assert(keys({ ...base, companion: 'family', children: 2 }).includes('kidsSnacks'));
  assert(keys({ ...base, interests: ['beach'] }).includes('swimwear'));
  assert(!keys({ ...base, international: false }).includes('plugAdapter'));
  const socks = (n: number) => suggestPacking({ ...base, nights: n }).find((x) => x.key === 'socks')!.quantity;
  assertEquals(socks(2), 3);
  assertEquals(socks(20), 8, 'uzun seyahatte en fazla 8 (çamaşır yıkanır)');
  assertEquals(new Set(keys(base)).size, keys(base).length, 'tekrar eden öğe olmamalı');
});

Deno.test('jetLagPlan: yön, fark ve uyum süresi', () => {
  const at = new Date('2026-10-20T12:00:00Z');
  assertEquals(offsetHours('Europe/Istanbul', 'Asia/Tokyo', at), 6);
  const east = jetLagPlan('Europe/Istanbul', 'Asia/Tokyo', at);
  assertEquals([east.direction, east.hours, east.recoveryDays, east.shiftPerDay, east.daysBefore, east.severity], ['east', 6, 6, -1, 3, 'moderate']);
  const west = jetLagPlan('Europe/Istanbul', 'America/New_York', at);
  assertEquals([west.direction, west.hours, west.recoveryDays, west.shiftPerDay], ['west', -7, 5, 1]);
  assertEquals(jetLagPlan('Europe/Rome', 'Europe/Paris', at).direction, 'none');
  // Auckland'a +10 (kısa yol batıya değil, doğuya)
  const nz = jetLagPlan('Europe/Istanbul', 'Pacific/Auckland', at);
  assertEquals(nz.hours, 10);
  assertEquals(jetLagPlan('America/Los_Angeles', 'Asia/Kolkata', at).hours, -11.5);
});
