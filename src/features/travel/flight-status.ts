import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';

import i18n from '@/i18n';
import { formatTime } from '@/lib/format';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export type FlightState = 'scheduled' | 'delayed' | 'boarding' | 'departed' | 'arrived' | 'canceled' | 'diverted' | 'unknown';

export type FlightLeg = { scheduled_utc: string | null; revised_utc: string | null; delay_min: number; terminal: string | null; gate: string | null };

export type FlightInfo = {
  reservation_id: string;
  flight_number: string;
  checked_at: string;
  alert: 'none' | 'delay' | 'canceled';
  status: { state: FlightState; departure: FlightLeg; arrival: FlightLeg & { baggage_belt: string | null } };
};

const FIVE_MIN = 5 * 60_000;

/** Seyahatteki yaklaşan uçuşların canlı durumu (sunucu paylaşımlı önbellekten döner; anahtar yoksa boş liste). */
export function useFlightStatus(tripId: string | undefined, hasFlights: boolean) {
  const canCall = useSessionStore((s) => Boolean(s.session)) && isSupabaseConfigured();
  return useQuery({
    queryKey: ['flight_status', tripId],
    enabled: canCall && Boolean(tripId) && hasFlights,
    staleTime: FIVE_MIN,
    refetchInterval: FIVE_MIN,
    retry: false,
    queryFn: async (): Promise<FlightInfo[]> => {
      const { data, error } = await getSupabase().functions.invoke('flight-status', { body: { trip_id: tripId } });
      if (error) throw error;
      return ((data as { flights?: FlightInfo[] } | null)?.flights ?? []).filter((f) => f.status);
    },
  });
}

/** Bildirim tekrarını önlemek için: aynı gecikme/iptal durumu için yalnızca bir kez bildirilir. */
export function alertSignature(f: FlightInfo): string {
  return `${f.reservation_id}:${f.alert}:${Math.round(f.status.departure.delay_min / 10)}:${f.status.departure.gate ?? ''}`;
}

const SEEN_KEY = 'yola.flightAlerts';

/**
 * Gecikme (15 dk+) ya da iptal olduğunda, uygulama açıkken bir kez yerel bildirim gösterir.
 * Uygulama kapalıyken bildirim için sunucu tarafı anlık bildirim (push) gerekir.
 */
export function useFlightAlerts(flights: FlightInfo[] | undefined, timezones: Record<string, string | null>) {
  useEffect(() => {
    if (!flights?.length) return;
    (async () => {
      const permission = await Notifications.getPermissionsAsync();
      if (!permission.granted) return;
      const seen: string[] = JSON.parse((await AsyncStorage.getItem(SEEN_KEY)) ?? '[]');
      const next = [...seen];
      for (const f of flights) {
        if (f.alert === 'none') continue;
        const sig = alertSignature(f);
        if (seen.includes(sig)) continue;
        const revised = f.status.departure.revised_utc;
        const time = revised ? formatTime(revised, timezones[f.reservation_id] ?? null) : '';
        await Notifications.scheduleNotificationAsync({
          content:
            f.alert === 'canceled'
              ? { title: i18n.t('flightStatus.alertCanceledTitle'), body: i18n.t('flightStatus.alertCanceledBody', { number: f.flight_number }) }
              : { title: i18n.t('flightStatus.alertDelayTitle'), body: i18n.t('flightStatus.alertDelayBody', { number: f.flight_number, time, min: f.status.departure.delay_min }) },
          trigger: null,
        });
        next.push(sig);
      }
      await AsyncStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-50)));
    })().catch(() => undefined);
  }, [flights, timezones]);
}
