import { assertEquals } from 'jsr:@std/assert@1';

import { shouldAskForRating } from './rating-logic.ts';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 20);

Deno.test('shouldAskForRating: yeterli an, yaş ve bekleme süresi', () => {
  assertEquals(shouldAskForRating({ moments: 2, firstSeen: now - 10 * DAY, lastAsked: null }, now), false);
  assertEquals(shouldAskForRating({ moments: 3, firstSeen: now - 1 * DAY, lastAsked: null }, now), false);
  assertEquals(shouldAskForRating({ moments: 3, firstSeen: now - 3 * DAY, lastAsked: null }, now), true);
  assertEquals(shouldAskForRating({ moments: 5, firstSeen: now - 300 * DAY, lastAsked: now - 30 * DAY }, now), false);
  assertEquals(shouldAskForRating({ moments: 5, firstSeen: now - 300 * DAY, lastAsked: now - 121 * DAY }, now), true);
});
