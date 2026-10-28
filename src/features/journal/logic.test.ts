import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isEmptyEntry, isMood, journalDays, journalStats, photoPath } from './logic.ts';

test('henüz başlamamış seyahatte gün yok', () => {
  assert.deepEqual(journalDays('2026-11-10', '2026-11-15', '2026-11-01'), []);
  assert.deepEqual(journalDays(null, null, '2026-11-01'), []);
});

test('devam eden seyahatte başlangıçtan bugüne', () => {
  assert.deepEqual(journalDays('2026-11-10', '2026-11-15', '2026-11-12'), ['2026-11-10', '2026-11-11', '2026-11-12']);
});

test('biten seyahatte bitiş gününe kadar; bitiş tarihi yoksa bugüne', () => {
  assert.deepEqual(journalDays('2026-11-10', '2026-11-11', '2026-12-01'), ['2026-11-10', '2026-11-11']);
  assert.deepEqual(journalDays('2026-11-10', null, '2026-11-11'), ['2026-11-10', '2026-11-11']);
});

test('çok uzun aralık son 90 günle sınırlanır', () => {
  const days = journalDays('2026-01-01', null, '2026-12-31');
  assert.equal(days.length, 90);
  assert.equal(days[days.length - 1], '2026-12-31');
});

test('fotoğraf yolu kullanıcı/seyahat klasöründedir', () => {
  assert.equal(photoPath('u1', 't1', 'p1'), 'u1/t1/p1.jpg');
});

test('istatistik ve boş kayıt', () => {
  const e = { id: '1', trip_id: 't', entry_date: '2026-11-10', note: 'x', mood: null, photos: ['a', 'b'] } as const;
  assert.deepEqual(journalStats([{ ...e, photos: [...e.photos] }]), { days: 1, photos: 2 });
  assert.equal(isEmptyEntry({ note: '  ', mood: null, photos: [] }), true);
  assert.equal(isEmptyEntry({ note: '', mood: 'good', photos: [] }), false);
  assert.equal(isMood('amazing'), true);
  assert.equal(isMood('x'), false);
});
