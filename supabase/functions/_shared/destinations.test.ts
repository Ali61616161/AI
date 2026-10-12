import { assert, assertEquals } from 'jsr:@std/assert@1';

import { DESTINATIONS, drawWheel, landingAngle, spinPool } from './destinations.ts';
import { ALL_DESTINATIONS } from './visa-access.ts';

const base = { passports: ['TR'], extras: [], month: null, maxCost: 4 as const, visa: 'any' as const, region: null, vibe: null };

Deno.test('ülke havuzu: geçerli kodlar, yıl sonunu aşan aylar', () => {
  assert(DESTINATIONS.length > 100);
  for (const d of DESTINATIONS) assert(ALL_DESTINATIONS.includes(d.code), `pasaport verisinde olmayan kod: ${d.code}`);
  assertEquals(DESTINATIONS.find((d) => d.code === 'TH')!.months, [1, 2, 3, 11, 12]);
  assertEquals(new Set(DESTINATIONS.map((d) => d.code)).size, DESTINATIONS.length, 'tekrar eden ülke olmamalı');
});

Deno.test('filtreler: kendi ülkesi yok, bütçe, mevsim, bölge, vize', () => {
  assert(!spinPool(base).some((d) => d.code === 'TR'));
  assert(spinPool({ ...base, maxCost: 1 }).every((d) => d.cost === 1));
  assert(spinPool({ ...base, month: 1 }).every((d) => d.months.includes(1)));
  assert(spinPool({ ...base, region: 'asia' }).every((d) => d.region === 'asia'));
  const easy = spinPool({ ...base, visa: 'easy' }).map((d) => d.code);
  assert(easy.includes('GE') && easy.includes('JP'), 'TR pasaportuyla Gürcistan ve Japonya vizesiz');
  assert(!easy.includes('DE') && !easy.includes('US'), 'Almanya ve ABD vize ister');
  const withSchengen = spinPool({ ...base, extras: ['schengen_visa'], visa: 'easy' }).map((d) => d.code);
  assert(withSchengen.includes('DE') && withSchengen.includes('MX'), 'Schengen vizesiyle Almanya ve Meksika açılır');
});

Deno.test('çark: en fazla 8 dilim, kazanan dilim oka gelir', () => {
  const draw = drawWheel(spinPool(base), 8, () => 0.42)!;
  assertEquals(draw.slots.length, 8);
  assert(draw.winner >= 0 && draw.winner < 8);
  assertEquals(drawWheel([]), null);
  const angle = landingAngle(100, 2, 8);
  assert(angle >= 100 + 6 * 360);
  // Ok üstte: döndükten sonra kazanan dilimin ortası 0°'ye gelir.
  assertEquals(((angle % 360) + 2 * 45 + 22.5) % 360, 0);
});
