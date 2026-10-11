import { assert, assertEquals } from 'jsr:@std/assert@1';

import { computeTripStats, normalizeInsights, preferenceRule, type ReportItem } from './report.ts';

const item = (place: string | null, extra: Partial<ReportItem> = {}): ReportItem => ({
  kind: 'activity', title: place ?? 'x', place_name: place, lat: null, lng: null, status: 'planned', is_locked: false, category: null, ...extra,
});

Deno.test('computeTripStats: yerler, ziyaret, mesafe ve harcama', () => {
  const days = [
    {
      date: '2026-10-10', city: 'Roma', items: [
        item('Hotel', { is_locked: true, lat: 41.9, lng: 12.49 }),
        item('Colosseo', { lat: 41.8902, lng: 12.4922, status: 'visited', category: 'history' }),
        item('Pantheon', { lat: 41.8986, lng: 12.4769, status: 'visited', category: 'history' }),
        item(null, { kind: 'free_time' }),
      ],
    },
    {
      date: '2026-10-11', city: 'Firenze', items: [
        item('Train', { kind: 'transport', lat: 43.776, lng: 11.248 }),
        item('Uffizi', { lat: 43.7678, lng: 11.2553, status: 'skipped', category: 'art' }),
        item('Trattoria', { kind: 'meal', category: 'food' }),
      ],
    },
  ];
  const s = computeTripStats(days, [{ amount: 40.5, category: 'food' }, { amount: 19.5, category: 'food' }, { amount: 30, category: 'transport' }], [{ place_name: 'Colosseo', rating: 5 }, { place_name: 'Pantheon', rating: 4 }]);
  assertEquals([s.days, s.cities, s.places, s.visited, s.skipped, s.rated, s.averageRating], [2, 2, 4, 2, 1, 2, 4.5]);
  assertEquals(s.spent, 90);
  assertEquals(s.spentByCategory, { food: 60, transport: 30 });
  assertEquals(s.topCategory, 'history');
  // Otel → Kolezyum → Pantheon ≈ 1,4 + 1,5 km; Floransa'da atlanan Uffizi sayılmaz.
  assert(s.distanceKm > 2.5 && s.distanceKm < 3.5, String(s.distanceKm));
});

Deno.test('computeTripStats: şehirler arası atlama mesafeye katılmaz', () => {
  const s = computeTripStats([{ date: 'd', city: 'X', items: [item('A', { lat: 41.9, lng: 12.5 }), item('B', { lat: 45.46, lng: 9.19 })] }], [], []);
  assertEquals(s.distanceKm, 0);
});

Deno.test('normalizeInsights: sadece izinli etiketler, çelişen etiket beğenilende kalır', () => {
  const r = normalizeInsights({ summary: ' Harika bir hafta. ', highlights: ['Kolezyum', '', 'Gelato', 'x', 'y'], liked: ['history', 'food', 'casino', 'food'], disliked: ['food', 'nightlife'], next_trip_tip: 'Floransa' });
  assertEquals(r, { summary: 'Harika bir hafta.', highlights: ['Kolezyum', 'Gelato', 'x'], liked: ['history', 'food'], disliked: ['nightlife'], nextTripTip: 'Floransa' });
});

Deno.test('preferenceRule: geçmiş seyahatlerden net tercih', () => {
  assertEquals(preferenceRule([]), null);
  const rule = preferenceRule([{ liked: ['history', 'food'], disliked: ['nightlife'] }, { liked: ['food'], disliked: ['history'] }, { liked: [], disliked: ['history'] }])!;
  assert(rule.includes('enjoyed food'), rule);
  assert(rule.includes('less keen on nightlife, history') || rule.includes('less keen on history, nightlife'), rule);
});
