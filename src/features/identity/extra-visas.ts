import type { ExtraVisa } from '../../../supabase/functions/_shared/visa-access.ts';

export type { ExtraVisa };

/** Ek vize ve oturum izinleri; arayüzde iki grup halinde gösterilir. */
export const VISA_GROUPS: { key: 'visas' | 'residence'; items: { key: ExtraVisa; flag: string }[] }[] = [
  {
    key: 'visas',
    items: [
      { key: 'schengen_visa', flag: '🇪🇺' },
      { key: 'us_visa', flag: '🇺🇸' },
      { key: 'uk_visa', flag: '🇬🇧' },
      { key: 'ca_visa', flag: '🇨🇦' },
      { key: 'au_visa', flag: '🇦🇺' },
      { key: 'nz_visa', flag: '🇳🇿' },
      { key: 'jp_visa', flag: '🇯🇵' },
      { key: 'ie_visa', flag: '🇮🇪' },
      { key: 'kr_visa', flag: '🇰🇷' },
    ],
  },
  {
    key: 'residence',
    items: [
      { key: 'eu_residence', flag: '🇪🇺' },
      { key: 'us_green_card', flag: '🇺🇸' },
      { key: 'uk_residence', flag: '🇬🇧' },
      { key: 'ca_pr', flag: '🇨🇦' },
      { key: 'au_pr', flag: '🇦🇺' },
      { key: 'jp_residence', flag: '🇯🇵' },
      { key: 'gcc_residence', flag: '🌐' },
    ],
  },
];

export const VISA_FLAG: Record<string, string> = Object.fromEntries(VISA_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.flag])));
