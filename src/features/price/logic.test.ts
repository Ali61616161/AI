import assert from 'node:assert/strict';
import { test } from 'node:test';

import { formProblem, normalizeDate, parsePoints, parseTarget, trend, type WatchForm } from './logic.ts';

const base: WatchForm = {
  origin: { code: 'IST', name: 'Istanbul' },
  destination: { code: 'ROM', name: 'Rome' },
  depart: '2026-12-05',
  ret: '',
  flexible: false,
  target: '',
};

test('normalizeDate: tam tarih, geçersiz gün, esnek ay', () => {
  assert.equal(normalizeDate('2026-12-05', false), '2026-12-05');
  assert.equal(normalizeDate('2026-02-30', false), null);
  assert.equal(normalizeDate('2026-12', false), null);
  assert.equal(normalizeDate('2026-12', true), '2026-12-01');
  assert.equal(normalizeDate('2026-13', true), null);
  assert.equal(normalizeDate('abc', true), null);
});

test('parseTarget: boş, virgül, geçersiz', () => {
  assert.equal(parseTarget(''), null);
  assert.equal(parseTarget('120,5'), 120.5);
  assert.equal(parseTarget('0'), 'invalid');
  assert.equal(parseTarget('x'), 'invalid');
});

test('formProblem: rota, tarih, geçmiş, dönüş, hedef', () => {
  const today = '2026-11-01';
  assert.equal(formProblem(base, today), null);
  assert.equal(formProblem({ ...base, origin: null }, today), 'route');
  assert.equal(formProblem({ ...base, destination: base.origin }, today), 'route');
  assert.equal(formProblem({ ...base, depart: '12/05' }, today), 'depart');
  assert.equal(formProblem({ ...base, depart: '2026-10-01' }, today), 'past');
  assert.equal(formProblem({ ...base, ret: '2026-12-05' }, today), 'return');
  assert.equal(formProblem({ ...base, ret: '2026-12-12' }, today), null);
  assert.equal(formProblem({ ...base, target: '-5' }, today), 'target');
  // Esnek ay: bu ay içinde sonraki günler hâlâ geçerli.
  assert.equal(formProblem({ ...base, flexible: true, depart: '2026-11' }, today), null);
  assert.equal(formProblem({ ...base, flexible: true, depart: '2026-10' }, today), 'past');
});

test('trend ve nokta ayrıştırma', () => {
  assert.equal(trend([{ d: 'a', p: 100 }]), null);
  assert.deepEqual(trend([{ d: 'a', p: 100 }, { d: 'b', p: 90 }]), { trend: 'down', pct: -10 });
  assert.deepEqual(trend([{ d: 'a', p: 100 }, { d: 'b', p: 100 }]), { trend: 'flat', pct: 0 });
  assert.deepEqual(parsePoints([{ d: 'a', p: 1 }, { d: 2 }, null]), [{ d: 'a', p: 1 }]);
  assert.deepEqual(parsePoints('x'), []);
});
