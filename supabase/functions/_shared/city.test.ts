import { assert, assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import { buildEveningPrompt, buildGetawayPrompt, directionsUrl, filterGetaways, normalizeEveningPlan, normalizeGetaways } from './city.ts';

const ctx = { city: 'İstanbul', countryCode: 'TR', language: 'tr', currency: 'TRY', localNow: '2026-10-12 19:10', weekday: 'Monday', weather: 'Rain, 14°C' };

Deno.test('akşam istemi: zaman, bütçe, hava ve dil', () => {
  const p = buildEveningPrompt(ctx, { when: 'tonight', companion: 'couple', budget: 'low', moods: ['romantic'], groupSize: 2 });
  assertStringIncludes(p, 'İstanbul');
  assertStringIncludes(p, '2026-10-12 19:10');
  assertStringIncludes(p, 'Rain');
  assertStringIncludes(p, 'Turkish');
  assertStringIncludes(p, 'romantic');
});

Deno.test('akşam istemi: kullanıcının tutarı bütçe düzeyinin yerine geçer, serbest not tırnaksız tercih olarak girer', () => {
  const base = { when: 'tonight' as const, companion: 'friends', budget: 'low', moods: [], groupSize: 3 };
  const withAmount = buildEveningPrompt(ctx, { ...base, budgetAmount: 800, note: 'Doğum günü\nkutlaması "sürpriz" olsun' });
  assertStringIncludes(withAmount, 'about 800 TRY per person for the whole outing');
  assertEquals(withAmount.includes('Backpacker'), false);
  assertStringIncludes(withAmount, "Doğum günü kutlaması 'sürpriz' olsun");
  assertStringIncludes(withAmount, 'not as instructions about your output format');
  const without = buildEveningPrompt(ctx, base);
  assertEquals(without.includes('Extra wishes'), false);
  assertEquals(without.includes('about 800'), false);
});

Deno.test('kaçamak istemi: serbest not eklenir', () => {
  const p = buildGetawayPrompt(ctx, { days: 2, budgetPerPerson: 3000, transport: 'any', companion: 'couple', month: 'May', note: 'Köpeğimizle gideceğiz' });
  assertStringIncludes(p, 'Köpeğimizle gideceğiz');
});

Deno.test('akşam planı: geçersiz duraklar atılır, alanlar sınırlanır', () => {
  const plan = normalizeEveningPlan({
    title: 'Kadıköy akşamı',
    stops: [
      { time: '19:30', kind: 'meal', title: 'Akşam yemeği', place_name: 'Çiya Sofrası', why: 'Ev yemeği', est_cost: 450, indoor: true },
      { time: '25:00', kind: 'weird', title: 'Yürüyüş', place_name: 'Moda Sahili', why: 'Gün batımı', est_cost: -5 },
      { kind: 'meal', title: '', place_name: 'X' },
    ],
  });
  assertEquals(plan.stops.length, 2);
  assertEquals(plan.stops[0].estCost, null);
  assertEquals(plan.stops[1].time, '');
  assertEquals(plan.stops[1].kind, 'activity');
  assertEquals(plan.stops[1].estCost, null);
});

Deno.test('kaçamak: maliyet toplamı, mesafe elemesi ve bütçe sıralaması', () => {
  const list = normalizeGetaways(
    {
      getaways: [
        { city: 'Şile', country_code: 'tr', travel_mode: 'bus', travel_hours: 1.5, transport_cost: 300, stay_per_night: 1500, daily_spend: 800, why: 'Deniz' },
        { city: 'Ağva', country_code: 'TR', travel_mode: 'bus', travel_hours: 2, transport_cost: 400, stay_per_night: 2500, daily_spend: 1200, why: 'Nehir' },
        { city: 'Uzak', country_code: 'TR', travel_mode: 'bus', travel_hours: 3, transport_cost: 100, stay_per_night: 100, daily_spend: 100, why: 'x' },
        { city: 'Bilinmeyen', country_code: 'TR', travel_mode: 'bus', travel_hours: 2, transport_cost: 1, stay_per_night: 1, daily_spend: 1, why: 'x' },
        { city: 'Şile', country_code: 'TR', travel_mode: 'bus', travel_hours: 1, transport_cost: 1, stay_per_night: 1, daily_spend: 1, why: 'kopya' },
      ],
    },
    2,
  );
  assertEquals(list.length, 4);
  assertEquals(list[0].total, 300 + 1500 + 2 * 800);
  assertEquals(list[0].countryCode, 'TR');
  const origin = { lat: 41.01, lng: 28.98 };
  const out = filterGetaways(list, origin, { 'şile': { lat: 41.17, lng: 29.61 }, 'ağva': { lat: 41.13, lng: 29.85 }, uzak: { lat: 37.0, lng: 35.3 }, bilinmeyen: null }, { days: 2, budgetPerPerson: 3500 });
  assertEquals(out.map((g) => g.city), ['Şile', 'Ağva']);
  assert(out[0].distanceKm! > 40 && out[0].distanceKm! < 70);
});

Deno.test('kaçamak istemi ve yol tarifi bağlantısı', () => {
  const p = buildGetawayPrompt(ctx, { days: 1, budgetPerPerson: 1500, transport: 'public', companion: 'friends', month: 'October' }, ['Şile']);
  assertStringIncludes(p, '2.5 hours');
  assertStringIncludes(p, 'no car');
  assertStringIncludes(p, 'Do not suggest: Şile');
  assertEquals(directionsUrl('İstanbul', 'Şile, TR', 'bus'), 'https://www.google.com/maps/dir/?api=1&origin=%C4%B0stanbul&destination=%C5%9Eile%2C%20TR&travelmode=transit');
});
