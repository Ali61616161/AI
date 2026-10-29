import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import brand from '@/config/brand.json';
import { useLiveStore } from '@/features/live/live-store';
import { useActivePlan, useTrips } from '@/features/trips/queries';

import { buildWidgetTimeline, pickWidgetTrip } from './build-widget-timeline';
import type { TodaysPlanWidgetProps } from './types';

type WidgetHandle = { updateTimeline(entries: { date: Date; props: TodaysPlanWidgetProps }[]): void };
let widget: WidgetHandle | null | undefined;

/** Yerel modül yoksa (ör. Expo Go) içe aktarma hata verir; bu yüzden ilk kullanımda yüklenir. */
function getWidget(): WidgetHandle | null {
  if (widget === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      widget = (require('./todays-plan-widget') as { todaysPlanWidget: WidgetHandle }).todaysPlanWidget;
    } catch {
      widget = null;
    }
  }
  return widget;
}

/**
 * Aktif/yaklaşan seyahatin bugünkü planını iOS widget'ına gönderir. Seyahatler veya plan
 * yüklendiğinde/değiştiğinde, dil değiştiğinde ve uygulama öne geldiğinde yenilenir.
 */
export function useSyncWidget() {
  const { t, i18n } = useTranslation();
  const { data: trips } = useTrips();
  const [foregroundTick, setForegroundTick] = useState(0);
  const marks = useLiveStore((s) => s.marks);
  const trip = pickWidgetTrip(trips);
  const { data: plan, isPending: planPending } = useActivePlan(trip?.id);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (trips === undefined) return; // Oturum yok ya da liste henüz gelmedi: eski içerik kalsın.
    if (trip && planPending) return;
    try {
      getWidget()?.updateTimeline(buildWidgetTimeline(t, trip, plan, brand.scheme, new Date(), marks));
    } catch (e) {
      // Widget uzantısı olmayan derlemeler (ör. Expo Go) uygulamayı bozmasın.
      if (__DEV__) console.warn('[widget] update failed', e);
    }
  }, [t, i18n.language, trips, trip, plan, planPending, foregroundTick, marks]);
}
