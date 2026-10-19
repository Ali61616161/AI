import { Stack } from 'expo-router';
import { useEffect } from 'react';

import { identifyPurchaser } from '@/features/subscription/purchases';
import { useSessionStore } from '@/stores/session-store';
import { useAdsBootstrap } from '@/features/ads/use-ads-bootstrap';
import { useNotificationLinks } from '@/features/engagement/notification-links';
import { useEndedTripPrompt } from '@/features/report/use-ended-trip-prompt';
import { useSyncWidget } from '@/features/widget/use-sync-widget';

export default function AppLayout() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  useAdsBootstrap();
  useNotificationLinks();
  useSyncWidget();
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
      <Stack.Screen name="trip-ended" options={{ presentation: 'modal' }} />
      <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
      <Stack.Screen name="invite" options={{ presentation: 'modal' }} />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="trip-new" options={{ presentation: 'modal' }} />
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
