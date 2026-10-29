import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isCurrentOrFuture, isDuplicateNameError, isDuplicateTripName } from './trip-name.ts';

const trips = [
  { owner_id: 'u1', title: 'Zürih', status: 'planned' },
  { owner_id: 'u2', title: 'Roma', status: 'planned' },
  { owner_id: 'u1', title: 'Paris', status: 'cancelled' },
];

test('aynı ad: harf ve boşluk fark etmez, yalnızca kendi seyahatleri', () => {
  assert.equal(isDuplicateTripName(trips, '  zürih ', 'u1'), true);
  assert.equal(isDuplicateTripName(trips, 'Roma', 'u1'), false);
  assert.equal(isDuplicateTripName(trips, 'Paris', 'u1'), false);
  assert.equal(isDuplicateTripName(trips, '', 'u1'), false);
  assert.equal(isDuplicateTripName(undefined, 'Zürih', 'u1'), false);
  assert.equal(isDuplicateTripName(trips, 'Zürih', null), false);
});

test('sunucu hatası tanınır', () => {
  assert.equal(isDuplicateNameError({ message: 'duplicate_trip_title' }), true);
  assert.equal(isDuplicateNameError({ message: 'başka' }), false);
  assert.equal(isDuplicateNameError(null), false);
});

test('güncel veya gelecek seyahat', () => {
  assert.equal(isCurrentOrFuture({ start_date: '2026-10-28', end_date: '2026-10-31' }, '2026-10-29'), true);
  assert.equal(isCurrentOrFuture({ start_date: '2026-10-01', end_date: '2026-10-05' }, '2026-10-29'), false);
  assert.equal(isCurrentOrFuture({ start_date: '2026-12-01', end_date: null }, '2026-10-29'), true);
  assert.equal(isCurrentOrFuture({ start_date: null, end_date: null }, '2026-10-29'), true);
});

import { uniqueTripTitle } from './trip-name.ts';

test('belgeden kurulan seyahatte çakışan ad numaralanır', () => {
  const list = [
    { owner_id: 'u1', title: 'Zürih' },
    { owner_id: 'u1', title: 'Zürih (2)' },
  ];
  assert.equal(uniqueTripTitle(list, 'Roma', 'u1'), 'Roma');
  assert.equal(uniqueTripTitle(list, 'zürih', 'u1'), 'zürih (3)');
});
