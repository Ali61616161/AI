import type { TFunction } from 'i18next';

import { splitMinutes } from './live-flow';

/** "45 dk" ya da "1 sa 5 dk" (çeviri katmanından). */
export function durationText(t: TFunction, min: number): string {
  const { h, m } = splitMinutes(min);
  return h > 0 ? t('live.dur.hm', { h, m }) : t('live.dur.min', { count: m });
}
