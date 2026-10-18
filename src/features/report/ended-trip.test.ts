import { assertEquals } from 'jsr:@std/assert@1';

import { pickEndedTrip } from './ended-trip.ts';

const t = (id: string, end: string | null, status = 'planned') => ({ id, end_date: end, status });
const today = '2026-10-18';

Deno.test('pickEndedTrip: bitmiş ve son 30 gündeki en yeni seyahat seçilir', () => {
  const trips = [t('old', '2026-08-01'), t('a', '2026-10-05'), t('b', '2026-10-12'), t('future', '2026-11-01'), t('noend', null)];
  assertEquals(pickEndedTrip(trips, today, [])?.id, 'b');
});

Deno.test('pickEndedTrip: bugün biten seyahat henüz bitmiş sayılmaz', () => {
  assertEquals(pickEndedTrip([t('x', today)], today, []), null);
  assertEquals(pickEndedTrip([t('x', '2026-10-17')], today, [])?.id, 'x');
});

Deno.test('pickEndedTrip: gösterilmiş, tamamlanmış veya iptal seyahat atlanır', () => {
  const trips = [t('seen', '2026-10-15'), t('done', '2026-10-14', 'completed'), t('cancel', '2026-10-13', 'cancelled'), t('ok', '2026-10-10')];
  assertEquals(pickEndedTrip(trips, today, ['seen'])?.id, 'ok');
  assertEquals(pickEndedTrip(trips, today, ['seen', 'ok']), null);
  assertEquals(pickEndedTrip(undefined, today, []), null);
});

Deno.test('pickEndedTrip: 30 günlük sınır dahil', () => {
  assertEquals(pickEndedTrip([t('edge', '2026-09-18')], today, [])?.id, 'edge');
  assertEquals(pickEndedTrip([t('late', '2026-09-17')], today, []), null);
});
