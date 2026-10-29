import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState } from 'react-native';

import brand from '@/config/brand.json';
import { useLiveStore } from '@/features/live/live-store';
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
 * Eşitlemeler sırayla çalışır. Plan, seyahat ve işaretler art arda yüklenirken her biri "etkinlik yok"
 * sanıp yenisini açmasın (kilit ekranında aynı durak iki kez çıkıyordu).
 */
let queue: Promise<unknown> = Promise.resolve();
function enqueue(job: () => Promise<void>): void {
  queue = queue.then(job).catch(() => undefined);
}

/** Son başlatılan etkinliğin durağı: kullanıcı kilit ekranından kapattıysa aynı durak için yeniden açılmaz. */
let lastStartedKey: string | null = null;
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 400));

/**
 * Sürmekte olan seyahatin sıradaki durağını kilit ekranında ve Dynamic Island'da gösterir. Durağa 3 saatten az
 * kalınca başlar; geri sayımı iOS kendisi akıtır. Uygulama öne gelince, her dakika, plan değişince ve "gittim /
 * atla / buradayım" denince sıradaki durağa geçer; gün bitince kapanır. Widget uzantısı olmayan derlemelerde
 * (ENABLE_WIDGET kapalı) hiçbir şey yapmaz.
 */
export function useSyncLiveActivity() {
  const { t, i18n } = useTranslation();
  const { data: trips } = useTrips();
  const [tick, setTick] = useState(0);
  const marks = useLiveStore((s) => s.marks);
  const steps = useLiveStore((s) => s.steps);
  const trip = pickWidgetTrip(trips);
  const started = Boolean(trip?.start_date && trip.start_date <= todayIsoDate());
  const { data: plan } = useActivePlan(started ? trip?.id : undefined);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setTick((n) => n + 1);
    });
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') setTick((n) => n + 1);
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const f = getFactory();
    if (!f || trips === undefined) return;
    const today = plan?.day_plans.find((d) => d.date === todayIsoDate());
    const stop = started && today ? pickNextStop(today.plan_items, Date.now(), formatTime, { marks, steps }) : null;
    const city = today?.city ?? null;
    const tripId = trip?.id ?? null;
    enqueue(async () => {
      try {
        const instances = f.getInstances();
        if (!stop) {
          lastStartedKey = null;
          await Promise.all(instances.map((a) => a.end('default')));
          return;
        }
        const props: NextStopActivityProps = {
          heading: t(stop.now ? 'liveActivity.now' : 'liveActivity.next'),
          title: stop.title,
          time: stop.time,
          detail: [stop.time, city, stop.later > 0 ? t('liveActivity.later', { count: stop.later }) : null].filter(Boolean).join(' · '),
          targetMs: stop.targetMs,
          countLabel: t(stop.now ? 'liveActivity.endsIn' : 'liveActivity.startsIn'),
        };
        const stale = new Date(stop.staleAtMs);
        if (instances.length > 0) {
          await instances[0].update(props, stale);
          // Birden fazla kalmışsa fazlalıklar kapatılır.
          await Promise.all(instances.slice(1).map((a) => a.end('immediate')));
          return;
        }
        const key = stop.id ?? stop.title;
        if (lastStartedKey === key) return; // Kullanıcı bu durak için etkinliği kapattı.
        lastStartedKey = key;
        // Dokununca canlı görünüm açılır; orada odak durak zaten şu anki/sıradaki duraktır.
        f.start(props, `${brand.scheme}://trip-live?tripId=${tripId}`, stale);
        await settle();
      } catch (e) {
        if (__DEV__) console.warn('[live activity] sync failed', e);
      }
    });
  }, [t, i18n.language, trips, trip, started, plan, marks, steps, tick]);
}
