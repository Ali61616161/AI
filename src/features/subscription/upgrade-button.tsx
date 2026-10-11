import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';

/** Ücretsiz limit dolunca gösterilen "Pro'ya geç" düğmesi. */
export function UpgradeButton({ tripId }: { tripId?: string | null }) {
  const { t } = useTranslation();
  return <Chip icon="diamond-outline" label={t('paywall.upgrade')} onPress={() => router.push({ pathname: '/paywall', params: { reason: 'quota', ...(tripId ? { tripId } : {}) } })} />;
}
