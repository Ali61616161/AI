import * as Location from 'expo-location';
import { useEffect, useMemo, useState } from 'react';

import { useRoute, type RouteMode } from '@/features/transport/api';
import type { TripDetail, TripReservation } from '@/features/trips/queries';

import { leaveByMs, minutesLate, nextStop, overdueStop, freeDayKey, type DriftStop, type StopMark } from './drift-logic';
import { arrivedStop, distanceKm, leaveInMin, stableOrigin, WALK_MODE_KM } from './live-logic';
import { useLiveStore } from './live-store';

type Coords = { lat: number; lng: number };

/**
 * Canlı konum (ekran açıkken): her ~25 m'de güncellenir. `origin` ise rota sorguları için yalnızca
 * 300 m'den fazla hareket edilince değişir (her adımda yeni rota istenmez, kota korunur).
 * İzin bir kez istenir; verilmezse ikisi de null kalır.
 */
export function useHere(enabled: boolean): { here: Coords | null; origin: Coords | null } {
  const [here, setHere] = useState<Coords | null>(null);
  const [origin, setOrigin] = useState<Coords | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let sub: Location.LocationSubscription | null = null;
    (async () => {
      try {
        let permission = await Location.getForegroundPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) permission = await Location.requestForegroundPermissionsAsync();
        if (!permission.granted || !alive) return;
        sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25, timeInterval: 15_000 }, (p) => {
          const c = { lat: p.coords.latitude, lng: p.coords.longitude };
          setHere(c);
          setOrigin((prev) => stableOrigin(prev, c));
        });
        if (!alive) sub.remove();
      } catch {
        // konum alınamazsa rehberlik konumsuz çalışır
      }
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [enabled]);
  return { here, origin };
}

type Stop = DriftStop & { lat: number; lng: number };

const AIRPORT_WORD = /airport|havaliman|flughafen|aeropuerto|aéroport|aeroporto|аэропорт|机场|مطار/i;
/** Havalimanı adı aramada "Airport" kelimesi yoksa eklenir (ör. "IST" → "IST Airport"). */
export const airportSearchName = (name: string) => (AIRPORT_WORD.test(name) ? name : `${name} Airport`);

/**
 * Canlı seyahat rehberliği: saati geçmiş durak, sıradaki durağa yetişme süresi ve (yaklaşan bir uçuş
 * varsa) havalimanına en geç çıkış zamanı. Hepsi plan ve konumdan hesaplanır.
 */
export function useLiveGuidance(input: { trip: TripDetail | undefined; tripId: string; date: string | null; stops: Stop[]; isToday: boolean; nowMs: number }) {
  const { trip, tripId, date, stops, isToday, nowMs } = input;
  const marks = useLiveStore((s) => s.marks) as Record<string, StopMark>;
  const freeDays = useLiveStore((s) => s.freeDays);
  const freeDay = date ? Boolean(freeDays[freeDayKey(tripId, date)]) : false;
  const { here, origin } = useHere(isToday);
  const tripMode: RouteMode = trip?.local_transport === 'car' ? 'drive' : 'transit';

  const overdue = isToday ? overdueStop(stops, nowMs, marks, freeDay) : null;
  const upcoming = isToday && !freeDay ? nextStop(stops, nowMs, marks) : null;
  // Sıradaki durak yürüme mesafesindeyse yürüyüş, değilse seyahatin ulaşım türü.
  const mode: RouteMode = origin && upcoming && distanceKm(origin, upcoming) <= WALK_MODE_KM ? 'walk' : tripMode;
  const etaQuery = useRoute({
    origin,
    destination: upcoming ? { lat: upcoming.lat, lng: upcoming.lng } : null,
    mode,
    originName: null,
    destinationName: upcoming?.title ?? null,
    countryCode: null,
    departAt: null,
  });
  const etaRoute = etaQuery.data?.routes[0] ?? null;
  const etaMin = etaRoute?.durationMin ?? null;
  const leaveIn = upcoming ? leaveInMin(nowMs, etaMin, upcoming.starts_at) : null;
  const arrived = isToday ? arrivedStop(stops, here, nowMs, marks) : null;
  const late = upcoming && etaMin !== null ? minutesLate(nowMs, etaMin, upcoming.starts_at!) : null;

  // Önümüzdeki 24 saatteki ilk uçuş: kalkış havalimanına gerçek yol süresiyle "en geç çıkış" hesaplanır.
  const nowBucket = Math.floor(nowMs / 600_000);
  const flight = useMemo<TripReservation | null>(() => {
    const list = (trip?.reservations ?? []).filter((r) => r.type === 'flight' && Date.parse(r.starts_at) > nowMs && Date.parse(r.starts_at) - nowMs < 24 * 3_600_000);
    return list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.reservations, nowBucket]);
  const airportName = flight ? (flight.origin_name ?? flight.origin_code ?? null) : null;
  const hotelAddress = trip?.reservations.find((r) => r.type === 'hotel')?.address ?? null;
  const airportQuery = useRoute({
    origin: origin ?? (flight && hotelAddress ? { address: hotelAddress } : null),
    destination: airportName ? { address: airportSearchName(airportName) } : null,
    mode: tripMode,
    originName: null,
    destinationName: airportName,
    countryCode: null,
    departAt: null,
  });
  const airportTravelMin = airportQuery.data?.routes[0]?.durationMin ?? null;
  const leaveAt = flight && airportTravelMin !== null ? leaveByMs(Date.parse(flight.starts_at), airportTravelMin) : null;

  return { marks, freeDay, here, overdue, upcoming, etaMin, etaRoute, etaMode: mode, leaveIn, arrived, late, flight, airportName, airportTravelMin, leaveAt };
}
