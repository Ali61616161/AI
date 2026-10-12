import { assertEquals } from 'jsr:@std/assert@1';

import { daysLeft, daysUsed, firstOverstay, maxStayFrom, nextDayFreed } from './schengen.ts';

Deno.test('90/180: giriş ve çıkış günleri sayılır, pencere dışındakiler sayılmaz', () => {
  const stays = [{ entry_on: '2026-06-01', exit_on: '2026-06-10' }];
  assertEquals(daysUsed(stays, '2026-06-10'), 10);
  assertEquals(daysLeft(stays, '2026-07-01'), 80);
  // 1 Haziran'dan 180 gün sonra (28 Kasım) pencere dışına çıkar.
  assertEquals(daysUsed(stays, '2026-11-28'), 9);
  assertEquals(daysUsed(stays, '2026-12-07'), 0);
  assertEquals(nextDayFreed(stays, '2026-07-01'), '2026-11-28');
});

Deno.test('en fazla kalış: 60 gün kullanılmışsa yeni girişte 30 gün', () => {
  const stays = [{ entry_on: '2026-03-01', exit_on: '2026-04-29' }];
  assertEquals(daysUsed(stays, '2026-04-29'), 60);
  const r = maxStayFrom(stays, '2026-05-10');
  assertEquals(r.days, 30);
  assertEquals(r.lastDay, '2026-06-08');
  assertEquals(maxStayFrom([], '2026-05-10').days, 90);
});

Deno.test('kural aşımı tespiti', () => {
  assertEquals(firstOverstay([{ entry_on: '2026-01-01', exit_on: '2026-03-31' }]), null);
  assertEquals(firstOverstay([{ entry_on: '2026-01-01', exit_on: '2026-04-01' }]), '2026-04-01');
});
