import { assertEquals } from 'jsr:@std/assert@1';

import { asksFlightTimes, emptyHotel, hotelReservationRow, normalizeAnswers, parseAmount, parseClock, toggleTravelMode, type TripAnswers } from './trip-answers.ts';

const base: TripAnswers = { companion: 'solo', budget: 'mid', dailyBudget: '', currency: 'TRY', interests: ['art'], transport: 'mixed', travelModes: [], notes: '', hotels: [], arrivalTime: '', arrivalAirport: '', departureTime: '', departureAirport: '' };

Deno.test('parseAmount: farklı yazım biçimleri', () => {
  assertEquals(parseAmount('120'), 120);
  assertEquals(parseAmount('₺ 900'), 900);
  assertEquals(parseAmount('1.250,50'), 1250.5);
  assertEquals(parseAmount('1,250.50'), 1250.5);
  assertEquals(parseAmount('1.250'), 1250);
  assertEquals(parseAmount('99,5'), 99.5);
  assertEquals(parseAmount('2.5'), 2.5);
  assertEquals(parseAmount(''), null);
  assertEquals(parseAmount('abc'), null);
  assertEquals(parseAmount('0'), null);
  assertEquals(parseAmount('99999999'), null);
});

Deno.test('normalizeAnswers: hazır bütçe düzeyi tutar üretmez, Diğer tutarı kaydeder', () => {
  assertEquals(normalizeAnswers(base).budgetAmount, null);
  assertEquals(normalizeAnswers({ ...base, budget: 'lux' }).budgetTier, 'lux');
  const custom = normalizeAnswers({ ...base, budget: 'custom', dailyBudget: '1.250,50', currency: 'try' });
  assertEquals(custom.budgetAmount, { amount: 1250.5, currency: 'TRY' });
  assertEquals(custom.budgetTier, 'mid');
  assertEquals(custom.budgetError, false);
  assertEquals(normalizeAnswers({ ...base, budget: 'custom', dailyBudget: 'çok' }).budgetError, true);
  assertEquals(normalizeAnswers({ ...base, budget: 'custom', dailyBudget: '50', currency: 'TURK' }).budgetError, true);
});

Deno.test('normalizeAnswers: not kırpılır ve 1000 karakterle sınırlanır', () => {
  assertEquals(normalizeAnswers({ ...base, notes: '   ' }).notes, null);
  assertEquals(normalizeAnswers({ ...base, notes: '  Deniz  ' }).notes, 'Deniz');
  assertEquals(normalizeAnswers({ ...base, notes: 'a'.repeat(1500) }).notes?.length, 1000);
});

Deno.test('normalizeAnswers: otel doğrulama (boş satır yok sayılır, ad zorunlu, tarih sırası)', () => {
  const hotels = [emptyHotel(), { name: 'Hotel Rössli', address: 'Zürich', checkIn: '', checkOut: '' }];
  const ok = normalizeAnswers({ ...base, hotels });
  assertEquals(ok.hotels.length, 1);
  assertEquals(ok.hotelError, null);
  assertEquals(normalizeAnswers({ ...base, hotels: [{ name: '', address: 'x', checkIn: '', checkOut: '' }] }).hotelError, { index: 0, issue: 'name' });
  assertEquals(normalizeAnswers({ ...base, hotels: [{ name: 'A', address: '', checkIn: '2027-01-12', checkOut: '2027-01-11' }] }).hotelError, { index: 0, issue: 'dates' });
  assertEquals(normalizeAnswers({ ...base, hotels: [{ name: 'A', address: '', checkIn: '12/01', checkOut: '' }] }).hotelError, { index: 0, issue: 'dates' });
});

Deno.test('hotelReservationRow: tarih boşsa seyahat tarihleri, giriş 15:00 çıkış 11:00', () => {
  const row = hotelReservationRow({ name: ' Hotel Rössli ', address: ' Predigerplatz 1 ', checkIn: '', checkOut: '' }, 't1', { start: '2027-01-11', end: '2027-01-14' });
  assertEquals(row, { trip_id: 't1', type: 'hotel', title: 'Hotel Rössli', address: 'Predigerplatz 1', starts_at: '2027-01-11T15:00:00.000Z', ends_at: '2027-01-14T11:00:00.000Z' });
  assertEquals(hotelReservationRow({ name: 'A', address: '', checkIn: '', checkOut: '' }, 't1', { start: null, end: null }), null);
  const own = hotelReservationRow({ name: 'A', address: '', checkIn: '2027-02-01', checkOut: '2027-02-03' }, 't1', { start: '2027-01-11', end: '2027-01-14' });
  assertEquals(own?.starts_at, '2027-02-01T15:00:00.000Z');
});

Deno.test('saat: yaygın yazımlar HH:MM olur, geçersizler hata verir', () => {
  assertEquals(parseClock('930'), '09:30');
  assertEquals(parseClock('9.30'), '09:30');
  assertEquals(parseClock('21:05'), '21:05');
  assertEquals(parseClock('2500'), null);
  assertEquals(parseClock('abc'), null);
  assertEquals(normalizeAnswers({ ...base, arrivalTime: '14:10', departureTime: '' }).arrivalTime, '14:10');
  assertEquals(normalizeAnswers({ ...base, arrivalTime: '99' }).timeError, true);
  assertEquals(normalizeAnswers({ ...base }).timeError, false);
  assertEquals(normalizeAnswers({ ...base, arrivalAirport: '  Zürich Airport ' }).arrivalAirport, 'Zürich Airport');
});

Deno.test('ulaşım seçimi: "karar vermedim" tek başına, bir tür seçilince kalkar; tekrar basınca kalkar', () => {
  assertEquals(toggleTravelMode([], 'flight'), ['flight']);
  assertEquals(toggleTravelMode(['flight'], 'train'), ['flight', 'train']);
  assertEquals(toggleTravelMode(['flight', 'train'], 'flight'), ['train']);
  assertEquals(toggleTravelMode(['flight', 'train'], 'undecided'), ['undecided']);
  assertEquals(toggleTravelMode(['undecided'], 'car'), ['car']);
  assertEquals(toggleTravelMode(['undecided'], 'undecided'), []);
  // uçuş saati soruları yalnızca uçakla (ya da seçimsiz) sorulur
  assertEquals(asksFlightTimes([]), true);
  assertEquals(asksFlightTimes(['flight', 'car']), true);
  assertEquals(asksFlightTimes(['car']), false);
  assertEquals(asksFlightTimes(['train', 'ferry']), false);
});

Deno.test('normalizeAnswers: ulaşım türleri sıralı ve yalnızca bilinenler', () => {
  assertEquals(normalizeAnswers({ ...base, travelModes: ['ferry', 'flight'] }).travelModes, ['flight', 'ferry']);
});
