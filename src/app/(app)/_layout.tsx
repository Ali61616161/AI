import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { usePreferredLanguageSync } from '@/features/auth/sync-language';
import { identifyPurchaser } from '@/features/subscription/purchases';
import { useSessionStore } from '@/stores/session-store';
import { useAdsBootstrap } from '@/features/ads/use-ads-bootstrap';
import { useNotificationLinks } from '@/features/engagement/notification-links';
import { useEndedTripPrompt } from '@/features/report/use-ended-trip-prompt';
import { useSyncLiveActivity } from '@/features/widget/use-sync-live-activity';
import { useSyncWidget } from '@/features/widget/use-sync-widget';

/** Widget, Dynamic Island ya da bildirimle doğrudan bir ekrana inildiğinde altında hep ana sekmeler olur (geri/çıkış çalışır). */
export const unstable_settings = { anchor: '(tabs)' };

export default function AppLayout() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  useAdsBootstrap();
  usePreferredLanguageSync();
  useNotificationLinks();
  useSyncWidget();
  useSyncLiveActivity();
  useEndedTripPrompt();
  // Satın almalar Supabase kullanıcısına bağlanır (RevenueCat app_user_id).
  useEffect(() => {
    identifyPurchaser(userId);
  }, [userId]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="assistant" options={{ presentation: 'modal' }} />
      <Stack.Screen name="ticket" options={{ presentation: 'modal' }} />
      <Stack.Screen name="ticket-review" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip/[id]" />
      <Stack.Screen name="trip-live" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="trip-more" options={{ presentation: 'modal' }} />
      <Stack.Screen name="home-city" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-dates" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-versions" options={{ presentation: 'modal' }} />
      <Stack.Screen name="preferences" options={{ presentation: 'modal' }} />
      <Stack.Screen name="hotels" options={{ presentation: 'modal' }} />
      <Stack.Screen name="phrases" options={{ presentation: 'modal' }} />
      <Stack.Screen name="translate" options={{ presentation: 'modal' }} />
      <Stack.Screen name="sos" options={{ presentation: 'modal' }} />
      <Stack.Screen name="expenses" options={{ presentation: 'modal' }} />
      <Stack.Screen name="currency" options={{ presentation: 'modal' }} />
      <Stack.Screen name="wallet" options={{ presentation: 'modal' }} />
      <Stack.Screen name="packing" options={{ presentation: 'modal' }} />
      <Stack.Screen name="visa" options={{ presentation: 'modal' }} />
      <Stack.Screen name="jetlag" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-report" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-journal" options={{ presentation: 'modal' }} />
      <Stack.Screen name="price-watch" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-ended" options={{ presentation: 'modal' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
      <Stack.Screen name="join" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="trip-new" options={{ presentation: 'modal' }} />
      <Stack.Screen name="trip-building" options={{ presentation: 'fullScreenModal', gestureEnabled: false, animation: 'fade' }} />
      <Stack.Screen name="trip-documents" options={{ presentation: 'modal' }} />
      <Stack.Screen name="decide" options={{ presentation: 'modal' }} />
      <Stack.Screen name="route" options={{ presentation: 'modal' }} />
      <Stack.Screen name="place" options={{ presentation: 'modal' }} />
      <Stack.Screen name="map" options={{ presentation: 'fullScreenModal' }} />
      <Stack.Screen name="refer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="social" />
      <Stack.Screen name="passport" options={{ presentation: 'modal' }} />
      <Stack.Screen name="evening" options={{ presentation: 'modal' }} />
      <Stack.Screen name="getaway" options={{ presentation: 'modal' }} />
      <Stack.Screen name="saved" options={{ presentation: 'modal' }} />
      <Stack.Screen name="city-passport" options={{ presentation: 'modal' }} />
      <Stack.Screen name="spin" options={{ presentation: 'modal' }} />
      <Stack.Screen name="visited" options={{ presentation: 'modal' }} />
      <Stack.Screen name="my-docs" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
