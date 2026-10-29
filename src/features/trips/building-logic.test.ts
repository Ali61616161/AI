import assert from 'node:assert/strict';
import { test } from 'node:test';

import { asBuildError, MIN_BUILD_MS, progressFraction, remainingHoldMs, stepIndex } from './building-logic.ts';

test('en az 10 sn bekletir; hata olduysa beklemez', () => {
  assert.equal(remainingHoldMs(0, 3_000, false), MIN_BUILD_MS - 3_000);
  assert.equal(remainingHoldMs(0, 12_000, false), 0);
  assert.equal(remainingHoldMs(0, 1_000, true), 0);
});

test('adım sırası son adımda kalır', () => {
  assert.equal(stepIndex(0, 5), 0);
  assert.equal(stepIndex(4_100, 5), 1);
  assert.equal(stepIndex(99_000, 5), 4);
});

test('ilerleme artar ve %92 üstüne çıkmaz', () => {
  assert.ok(progressFraction(0) < progressFraction(10_000));
  assert.ok(progressFraction(10_000) < progressFraction(40_000));
  assert.ok(progressFraction(600_000) <= 0.92);
  assert.equal(progressFraction(-5), 0);
});

test('hata kodu tanınır', () => {
  assert.equal(asBuildError('quota_exceeded'), 'quota_exceeded');
  assert.equal(asBuildError('x'), null);
  assert.equal(asBuildError(undefined), null);
});
