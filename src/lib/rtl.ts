import { useTranslation } from 'react-i18next';

import { isRTL, isSupportedLanguage } from '@/i18n/languages';

const FLIP = { transform: [{ scaleX: -1 }] } as const;

/** Yön bildiren ikonlar (ok, ›) sağdan sola dillerde aynalanır. */
export function useFlipStyle() {
  const { i18n } = useTranslation();
  return isSupportedLanguage(i18n.language) && isRTL(i18n.language) ? FLIP : undefined;
}
