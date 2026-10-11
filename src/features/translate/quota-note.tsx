import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';

import { UpgradeButton } from '@/features/subscription/upgrade-button';

import { useQuotaStatus } from './api';

/** Ücretsiz planda bugün kalan kullanımı gösterir; sınırsız planda hiçbir şey göstermez. */
export function QuotaNote({ feature }: { feature: 'text_translation' | 'voice_translation' | 'menu_scan' }) {
  const { t } = useTranslation();
  const { data } = useQuotaStatus(feature);
  if (!data || data.per_day === null) return null;
  const left = Math.max(data.per_day - data.used_today, 0);
  const label =
    feature === 'voice_translation'
      ? t('translate.quotaVoice', { minutes: Math.floor(left / 60), seconds: String(left % 60).padStart(2, '0') })
      : t('translate.quotaLeft', { count: left });
  return (
    <>
      <Text variant="caption" color={left === 0 ? 'warning' : 'textMuted'}>
        {label}
      </Text>
      {left === 0 && <UpgradeButton />}
    </>
  );
}
