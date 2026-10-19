import { Platform } from 'react-native';

import { useCurrentPlan } from '@/features/subscription/purchases';

import { useAdsStore } from './ads-store';

/** Ücretsiz plandaki kullanıcı mı? Pro ve Trip Pass reklam görmez. */
export function useIsFreePlan(): boolean {
  const { data: plan, isSuccess } = useCurrentPlan();
  return isSuccess && plan === 'free';
}

/** Reklam gösterilebilir mi: ücretsiz plan, izinler alınmış, SDK hazır, mobil cihaz. */
export function useShowAds(): boolean {
  const free = useIsFreePlan();
  const ready = useAdsStore((s) => s.ready);
  return Platform.OS !== 'web' && free && ready;
}
