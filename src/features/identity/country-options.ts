import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { flag } from '@/features/tools/emergency-numbers';
import { COUNTRIES, localCountryName } from '@/features/tools/countries';

/** Bayraklı ve uygulama dilinde sıralı ülke listesi (seçim listeleri için). */
export function useCountryOptions() {
  const { i18n } = useTranslation();
  return useMemo(
    () =>
      COUNTRIES.map((c) => ({ value: c.code, name: localCountryName(c.code, i18n.language), label: `${flag(c.code)}  ${localCountryName(c.code, i18n.language)}` }))
        .sort((a, b) => a.name.localeCompare(b.name, i18n.language))
        .map(({ value, label }) => ({ value, label })),
    [i18n.language],
  );
}
