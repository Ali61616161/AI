import assert from 'node:assert/strict';
import { test } from 'node:test';

import { LEAD_MS, pickNextStop, type StopItem } from './next-stop.ts';

const fmt = (iso: string) => iso.slice(11, 16);
const item = (starts: string | null, ends: string | null, extra: Partial<StopItem> = {}): StopItem => ({
  status: 'planned',
  starts_at: starts,
  ends_at: ends,
  timezone: null,
  title: 'Stop',
  place_name: null,
  ...extra,
});
const at = (hhmm: string) => Date.parse(`2026-11-05T${hhmm}:00Z`);

test('sıradaki durak: bitmemiş ilk saatli kalem, sonrası sayılır', () => {
  const items = [item('2026-11-05T09:00:00Z', '2026-11-05T10:00:00Z', { title: 'Müze' }), item('2026-11-05T12:00:00Z', null, { title: 'Öğle', place_name: 'Trattoria' }), item('2026-11-05T15:00:00Z', null)];
  const s = pickNextStop(items, at('10:30'), fmt)!;
  assert.equal(s.title, 'Trattoria');
  assert.equal(s.time, '12:00');
  assert.equal(s.now, false);
  assert.equal(s.later, 1);
});

test('şu an süren durak "now" olur', () => {
  const s = pickNextStop([item('2026-11-05T09:00:00Z', '2026-11-05T11:00:00Z')], at('10:00'), fmt)!;
  assert.equal(s.now, true);
  assert.equal(s.staleAtMs, at('11:00'));
});

test('durağa çok vakit varsa ya da hiç kalem kalmadıysa null', () => {
  assert.equal(pickNextStop([item('2026-11-05T20:00:00Z', null)], at('09:00'), fmt), null);
  assert.equal(pickNextStop([item('2026-11-05T09:00:00Z', '2026-11-05T10:00:00Z')], at('18:00'), fmt), null);
  assert.equal(pickNextStop([], at('09:00'), fmt), null);
  assert.ok(LEAD_MS > 0);
});

test('atlanan/tamamlanan ve saatsiz kalemler yok sayılır', () => {
  const items = [item('2026-11-05T12:00:00Z', null, { status: 'skipped' }), item(null, null), item('2026-11-05T13:00:00Z', null, { title: 'Gerçek' })];
  assert.equal(pickNextStop(items, at('11:00'), fmt)!.title, 'Gerçek');
});

test('süresi belli olmayan durak bir saat sonra geçmiş sayılır', () => {
  const items = [item('2026-11-05T12:00:00Z', null)];
  assert.notEqual(pickNextStop(items, at('12:30'), fmt), null);
  assert.equal(pickNextStop(items, at('13:01'), fmt), null);
});
