import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import brand from '@/config/brand.json';
import { useActivePlan, useTrips } from '@/features/trips/queries';
import { formatTime, todayIsoDate } from '@/lib/format';

import { pickNextStop } from './next-stop';
import type { NextStopActivityProps } from './types';
import { pickWidgetTrip } from './build-widget-timeline';

type Activity = { update(props: NextStopActivityProps, staleDate?: Date): Promise<void>; end(policy?: 'default' | 'immediate'): Promise<void> };
type Factory = { start(props: NextStopActivityProps, url?: string, staleDate?: Date): Activity; getInstances(): Activity[] };
let factory: Factory | null | undefined;

/** Yerel modül yoksa (ör. Expo Go) içe aktarma hata verir; bu yüzden ilk kullanımda yüklenir. */
function getFactory(): Factory | null {
  if (factory === undefined) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      factory = (require('./next-stop-activity') as { nextStopActivity: Factory }).nextStopActivity;
    } catch {
      factory = null;
    }
  }
  return factory;
}

/**
 * Sürmekte olan seyahatin sıradaki durağını kilit ekranında ve Dynamic Island'da gösterir. Durağa 3 saatten az
 * kalınca başlar, uygulama öne gelince ve plan değişince güncellenir, gün bitince kapanır. Widget uzantısı
 * olmayan derlemelerde (ENABLE_WIDGET kapalı) hiçbir şey yapmaz.
 */
export function useSyncLiveActivity() {
  const { t, i18n } = useTranslation();
  const { data: trips } = useTrips();
  const [tick, setTick] = useState(0);
  const trip = pickWidgetTrip(trips);
  const started = Boolean(trip?.start_date && trip.start_date <= todayIsoDate());
  const { data: plan } = useActivePlan(started ? trip?.id : undefined);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const f = getFactory();
    if (!f || trips === undefined) return;
    (async () => {
      try {
        const today = plan?.day_plans.find((d) => d.date === todayIsoDate());
        const stop = started && today ? pickNextStop(today.plan_items, Date.now(), formatTime) : null;
        const instances = f.getInstances();
        if (!stop) {
          await Promise.all(instances.map((a) => a.end('default')));
          return;
        }
        const props: NextStopActivityProps = {
          heading: t(stop.now ? 'liveActivity.now' : 'liveActivity.next'),
          title: stop.title,
          time: stop.time,
          detail: [today?.city, stop.later > 0 ? t('liveActivity.later', { count: stop.later }) : null].filter(Boolean).join(' · '),
        };
        const stale = new Date(stop.staleAtMs);
        if (instances.length > 0) await instances[0].update(props, stale);
        else f.start(props, `${brand.scheme}://trip/${trip!.id}`, stale);
        // Birden fazla kalmışsa fazlalıklar kapatılır.
        await Promise.all(instances.slice(1).map((a) => a.end('immediate')));
      } catch (e) {
        if (__DEV__) console.warn('[live activity] sync failed', e);
      }
    })();
  }, [t, i18n.language, trips, trip, started, plan, tick]);
}
