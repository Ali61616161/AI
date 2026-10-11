import { assertEquals, assertStringIncludes } from 'jsr:@std/assert@1';

import type { TripReservation } from './itinerary.ts';
import {
  analyzeDateChange,
  buildCrisisPrompt,
  diffPlans,
  normalizeCrisis,
  replaceRestOfDay,
  shortenRules,
  storedDayToPayload,
  type StoredDay,
  type StoredItem,
} from './replan.ts';

const reservations: TripReservation[] = [
  {
    id: 'out', type: 'flight', title: 'TK1865', starts_at: '2026-11-12T05:10:00Z', ends_at: '2026-11-12T08:45:00Z',
    start_timezone: 'Europe/Istanbul', end_timezone: 'Europe/Rome', origin_name: 'IST', destination_name: 'FCO', address: null,
  },
  {
    id: 'hotel', type: 'hotel', title: 'Hotel Artemide', starts_at: '2026-11-12T13:00:00Z', ends_at: '2026-11-15T10:00:00Z',
    start_timezone: 'Europe/Rome', end_timezone: 'Europe/Rome', origin_name: null, destination_name: null, address: 'Via Nazionale 22',
  },
  {
    id: 'back', type: 'flight', title: 'TK1866', starts_at: '2026-11-15T15:00:00Z', ends_at: '2026-11-15T18:30:00Z',
    start_timezone: 'Europe/Rome', end_timezone: 'Europe/Istanbul', origin_name: 'FCO', destination_name: 'IST', address: null,
  },
];

const item = (p: Partial<StoredItem> & Pick<StoredItem, 'title'>): StoredItem => ({
  position: 0, kind: 'activity', description: null, starts_at: null, ends_at: null, timezone: 'Europe/Rome', place_name: null,
  address: null, category: null, estimated_cost: null, cost_currency: null, priority: 3, is_indoor: null, is_locked: false,
  reservation_id: null, affiliate_partner: null, ...p,
});

const planDays: StoredDay[] = [
  { date: '2026-11-12', city: 'Roma', title: null, notes: null, plan_items: [item({ title: 'Kolezyum', priority: 5 })] },
  { date: '2026-11-13', city: 'Roma', title: null, notes: null, plan_items: [item({ title: 'Vatikan', priority: 5 }), item({ title: 'Trastevere', priority: 2 })] },
  { date: '2026-11-14', city: 'Roma', title: null, notes: null, plan_items: [item({ title: 'Pantheon', priority: 4 }), item({ title: 'Hotel', is_locked: true, priority: 5 })] },
];

Deno.test('analyzeDateChange: kısaltma → çıkan günler, dışarıda kalan dönüş uçuşu, kaybolan öne çıkanlar', () => {
  const a = analyzeDateChange({ oldStart: '2026-11-12', oldEnd: '2026-11-15', newStart: '2026-11-12', newEnd: '2026-11-13', reservations, planDays });
  assertEquals(a.removedDates, ['2026-11-14', '2026-11-15']);
  assertEquals(a.addedDates, []);
  assertEquals(a.reservationsOutside, [{ id: 'back', title: 'TK1866', date: '2026-11-15' }]);
  assertEquals(a.removedHighlights, [{ date: '2026-11-14', title: 'Pantheon' }], 'kilitli ve düşük öncelikli duraklar sayılmaz');
  assertEquals(a.uncoveredNights, []);
});

Deno.test('analyzeDateChange: uzatma → otelin kapsamadığı geceler', () => {
  const a = analyzeDateChange({ oldStart: '2026-11-12', oldEnd: '2026-11-15', newStart: '2026-11-12', newEnd: '2026-11-17', reservations, planDays });
  assertEquals(a.addedDates, ['2026-11-16', '2026-11-17']);
  // Otel 12–15 arası 3 gece; 15 ve 16 Kasım geceleri açıkta. Son gün (17) gecesi sayılmaz.
  assertEquals(a.uncoveredNights, ['2026-11-15', '2026-11-16']);
  const noHotel = analyzeDateChange({ oldStart: '2026-11-12', oldEnd: '2026-11-15', newStart: '2026-11-12', newEnd: '2026-11-17', reservations: [reservations[0]], planDays });
  assertEquals(noHotel.uncoveredNights, [], 'hiç otel rezervasyonu yoksa uyarı yok');
});

Deno.test('shortenRules: mevcut plan ve korunacak yerler istemde', () => {
  const rules = shortenRules(planDays, ['2026-11-12', '2026-11-13'], [{ title: 'Pantheon' }]);
  assertStringIncludes(rules.join('\n'), '2026-11-13: Vatikan, Trastevere');
  assertStringIncludes(rules.join('\n'), 'fit as many as possible into the remaining days: Pantheon');
});

Deno.test('normalizeCrisis: geçmiş saatteki öneriler atılır, plan değişikliği ancak öneri varsa', () => {
  const r = normalizeCrisis(
    {
      reply: '  Yağmur için kapalı yerler buldum.  ',
      change_plan: true,
      items: [
        { start_time: '13:00', kind: 'activity', title: 'Geçmiş', priority: 3 },
        { start_time: '15:30', kind: 'activity', title: 'Doria Pamphilj Galerisi', priority: 4, is_indoor: true, estimated_cost: 16, currency: 'EUR' },
        { start_time: '15:00', kind: 'meal', title: 'Kahve', priority: 2, is_indoor: true },
      ],
    },
    { nowTime: '14:40', currency: 'EUR' },
  );
  assertEquals(r.reply, 'Yağmur için kapalı yerler buldum.');
  assertEquals(r.items.map((i) => i.title), ['Kahve', 'Doria Pamphilj Galerisi']);
  assertEquals(r.changePlan, true);
  assertEquals(normalizeCrisis({ reply: 'x', change_plan: true, items: [] }, { nowTime: '10:00', currency: 'EUR' }).changePlan, false);
});

Deno.test('replaceRestOfDay: geçmiş ve kilitli duraklar kalır, uçuş öncesiyle çakışan öneri atılır', () => {
  const day: StoredDay = {
    date: '2026-11-15', city: 'Roma', title: 'Son gün', notes: null,
    plan_items: [
      item({ position: 0, title: 'Kahvaltı', starts_at: '2026-11-15T07:00:00Z' }), // 08:00 Roma, geçmiş
      item({ position: 1, title: 'Check-out', kind: 'accommodation', starts_at: '2026-11-15T10:00:00Z', is_locked: true }),
      item({ position: 2, title: 'Eski öğleden sonra', starts_at: '2026-11-15T12:00:00Z' }),
      item({ position: 3, title: 'TK1866', kind: 'transport', starts_at: '2026-11-15T15:00:00Z', is_locked: true }), // 16:00 Roma
    ],
  };
  const now = '2026-11-15T09:30:00Z'; // 10:30 Roma
  const payload = replaceRestOfDay(
    day,
    now,
    [
      { start_time: '11:30', end_time: '12:30', kind: 'activity', title: 'Borghese Galerisi', description: null, place_name: null, address: null, category: null, estimated_cost: 15, currency: 'EUR', priority: 4, is_indoor: true, is_locked: false, reservation_id: null, booking_partner: null, timezone: null },
      { start_time: '14:30', end_time: null, kind: 'meal', title: 'Uçuştan önce yemek', description: null, place_name: null, address: null, category: null, estimated_cost: null, currency: null, priority: 2, is_indoor: true, is_locked: false, reservation_id: null, booking_partner: null, timezone: null },
    ],
    'Europe/Rome',
  );
  assertEquals(payload.items.map((i) => i.title), ['Kahvaltı', 'Check-out', 'Borghese Galerisi', 'TK1866']);
  assertEquals(payload.items.map((i) => i.position), [0, 1, 2, 3]);
  const borghese = payload.items[2];
  assertEquals([borghese.starts_at, borghese.timezone, borghese.is_locked], ['2026-11-15T10:30:00.000Z', 'Europe/Rome', false]);
});

Deno.test('buildCrisisPrompt: mesaj, konum, saat ve kurallar', () => {
  const prompt = buildCrisisPrompt({
    language: 'tr', message: 'Yağmur başladı, "kapalı" bir yer bul', localNow: '2026-11-13T14:40', timezone: 'Europe/Rome',
    location: { lat: 41.89834, lng: 12.47634 }, city: 'Roma', budget: 'low', companion: 'solo', interests: ['art'], currency: 'EUR',
    remaining: [{ time: '15:00', title: 'Trastevere yürüyüşü', place: 'Trastevere' }], fixedLater: [],
  });
  assertStringIncludes(prompt, "The traveler says: \"Yağmur başladı, 'kapalı' bir yer bul\"");
  assertStringIncludes(prompt, '41.8983, 12.4763 (Roma)');
  assertStringIncludes(prompt, '2026-11-13 14:40 (Europe/Rome)');
  assertStringIncludes(prompt, '15:00 Trastevere yürüyüşü @ Trastevere');
  assertStringIncludes(prompt, 'Answer in Turkish');
});

Deno.test('diffPlans ve storedDayToPayload', () => {
  const after: StoredDay[] = [
    planDays[0],
    { ...planDays[1], plan_items: [item({ title: 'Vatikan' }), item({ title: 'Doria Pamphilj' })] },
  ];
  assertEquals(diffPlans(planDays, after), [
    { date: '2026-11-13', added: ['Doria Pamphilj'], removed: ['Trastevere'] },
    { date: '2026-11-14', added: [], removed: ['Pantheon', 'Hotel'] },
  ]);
  const payload = storedDayToPayload({ ...planDays[1], plan_items: [item({ title: 'B', position: 5 }), item({ title: 'A', position: 2 })] });
  assertEquals(payload.items.map((i) => [i.title, i.position]), [['A', 0], ['B', 1]]);
});
