import { router } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { useTrips } from '@/features/trips/queries';
import { todayIsoDate } from '@/lib/format';

import { pickEndedTrip } from './ended-trip';
import { useEndedTripStore } from './ended-trip-store';

/** Uygulama oturumu başına en fazla bir kez gösterilir. */
let shownThisSession = false;

/**
 * Seyahat bitince (son 30 gün) bir kez "Nasıldı?" penceresini açar. Ana ekran yerleşsin diye
 * kısa bir gecikmeyle; her seyahat için sadece bir kez, bir sonraki seyahate kadar tekrarlanmaz.
 */
export function useEndedTripPrompt() {
  const { data: trips } = useTrips();
  const seen = useEndedTripStore((s) => s.seen);
  // Kayıtlı "gösterildi" listesi telefondan yüklenmeden karar verilmez (yoksa aynı pencere tekrar çıkabilir).
  const hydrated = useSyncExternalStore(
    (onChange) => useEndedTripStore.persist.onFinishHydration(onChange),
    () => useEndedTripStore.persist.hasHydrated(),
    () => false,
  );

  useEffect(() => {
    if (shownThisSession || !hydrated) return;
    const trip = pickEndedTrip(trips, todayIsoDate(), seen);
    if (!trip) return;
    const timer = setTimeout(() => {
      shownThisSession = true;
      useEndedTripStore.getState().markSeen(trip.id);
      router.push({ pathname: '/trip-ended', params: { tripId: trip.id } });
    }, 1800);
    return () => clearTimeout(timer);
  }, [trips, seen, hydrated]);
}
