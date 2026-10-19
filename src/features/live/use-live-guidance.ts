import { useEffect, useMemo, useState } from 'react';

import { getCurrentLocation } from '@/features/plan/replan';
import { useRoute, type RouteMode } from '@/features/transport/api';
import type { TripDetail, TripReservation } from '@/features/trips/queries';

import { leaveByMs, minutesLate, nextStop, overdueStop, freeDayKey, type DriftStop, type StopMark } from './drift-logic';
import { useLiveStore } from './live-store';

type Coords = { lat: number; lng: number };

/** Kullanıcının konumu; açılışta ve 2 dakikada bir yenilenir. İzin yoksa null. */
export function useHere(enabled: boolean): Coords | null {
  const [here, setHere] = useState<Coords | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const tick = () => getCurrentLocation().then((c) => alive && c && setHere(c));
    tick();
    const id = setInterval(tick, 120_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [enabled]);
  return here;
}

type Stop = DriftStop & { lat: number; lng: number };

/**
 * Canlı seyahat rehberliği: saati geçmiş durak, sıradaki durağa yetişme süresi ve (yaklaşan bir uçuş
 * varsa) havalimanına en geç çıkış zamanı. Hepsi plan ve konumdan hesaplanır.
 */
export function useLiveGuidance(input: { trip: TripDetail | undefined; tripId: string; date: string | null; stops: Stop[]; isToday: boolean; nowMs: number }) {
  const { trip, tripId, date, stops, isToday, nowMs } = input;
  const marks = useLiveStore((s) => s.marks) as Record<string, StopMark>;
  const freeDays = useLiveStore((s) => s.freeDays);
  const freeDay = date ? Boolean(freeDays[freeDayKey(tripId, date)]) : false;
  const here = useHere(isToday);
  const mode: RouteMode = trip?.local_transport === 'car' ? 'drive' : 'transit';

  const overdue = isToday ? overdueStop(stops, nowMs, marks, freeDay) : null;
  const upcoming = isToday && !freeDay ? nextStop(stops, nowMs, marks) : null;
  const etaQuery = useRoute({
    origin: here,
    destination: upcoming ? { lat: upcoming.lat, lng: upcoming.lng } : null,
    mode,
    originName: null,
    destinationName: upcoming?.title ?? null,
    countryCode: null,
    departAt: null,
  });
  const etaMin = etaQuery.data?.routes[0]?.durationMin ?? null;
  const late = upcoming && etaMin !== null ? minutesLate(nowMs, etaMin, upcoming.starts_at!) : null;

  // Önümüzdeki 24 saatteki ilk uçuş: kalkış havalimanına gerçek yol süresiyle "en geç çıkış" hesaplanır.
  const nowBucket = Math.floor(nowMs / 600_000);
  const flight = useMemo<TripReservation | null>(() => {
    const list = (trip?.reservations ?? []).filter((r) => r.type === 'flight' && Date.parse(r.starts_at) > nowMs && Date.parse(r.starts_at) - nowMs < 24 * 3_600_000);
    return list.sort((a, b) => a.starts_at.localeCompare(b.starts_at))[0] ?? null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip?.reservations, nowBucket]);
  const airportName = flight ? (flight.origin_name ?? flight.origin_code) : null;
  const airportQuery = useRoute({
    origin: here ?? (flight ? { address: trip?.reservations.find((r) => r.type === 'hotel')?.address ?? '' } : null),
    destination: airportName ? { address: /airport|havaliman|flughafen|aeropuerto|aéroport|aeroporto|аэропорт/i.test(airportName) ? airportName : `${airportName} Airport` } : null,
    mode,
    originName: null,
    destinationName: airportName,
    countryCode: null,
    departAt: null,
  });
  const airportTravelMin = airportQuery.data?.routes[0]?.durationMin ?? null;
  const leaveAt = flight && airportTravelMin !== null ? leaveByMs(Date.parse(flight.starts_at), airportTravelMin) : null;

  return { marks, freeDay, here, overdue, upcoming, etaMin, late, flight, airportName, airportTravelMin, leaveAt };
}
