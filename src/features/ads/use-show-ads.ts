import { Platform } from 'react-native';

import { useCurrentPlan } from '@/features/subscription/purchases';
import { useSessionStore } from '@/stores/session-store';

import { useAdsStore } from './ads-store';

/** Ücretsiz plandaki (veya hesapsız) kullanıcı mı? Pro ve Trip Pass reklam görmez. */
export function useIsFreePlan(): boolean {
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const guest = useSessionStore((s) => s.isGuest);
  const { data: plan, isSuccess } = useCurrentPlan();
  if (guest && !signedIn) return true;
  return isSuccess && plan === 'free';
}

/** Reklam gösterilebilir mi: ücretsiz plan, izinler alınmış, SDK hazır, mobil cihaz. */
export function useShowAds(): boolean {
  const free = useIsFreePlan();
  const ready = useAdsStore((s) => s.ready);
  return Platform.OS !== 'web' && free && ready;
}
