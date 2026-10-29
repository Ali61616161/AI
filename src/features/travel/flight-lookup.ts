import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { normalizeFlightNumber, type FlightInfo } from '../../../supabase/functions/_shared/flight-status.ts';

export type { FlightInfo };

/** Uçuş numarası + tarihle havalimanları ve saatler (AeroDataBox; sunucu önbellekli). Bulunamazsa ya da servis yoksa null. */
export async function lookupFlight(number: string, date: string): Promise<FlightInfo | null> {
  if (!isSupabaseConfigured()) return null;
  const { data, error } = await getSupabase().functions.invoke('flight-status', { body: { lookup: true, number, date } });
  if (error) throw error;
  return ((data as { flight?: FlightInfo | null } | null)?.flight ?? null) as FlightInfo | null;
}

/** Yazma bitince (gecikmeli) uçuşu arar; her tuşta sorgu gitmesin (aramalar saatte sınırlı). */
export function useFlightLookup(raw: string, date: string | null, delayMs = 700) {
  const [settled, setSettled] = useState(raw);
  useEffect(() => {
    const id = setTimeout(() => setSettled(raw), delayMs);
    return () => clearTimeout(id);
  }, [raw, delayMs]);
  const number = normalizeFlightNumber(settled);
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const valid = Boolean(date && /^\d{4}-\d{2}-\d{2}$/.test(date));
  const query = useQuery({
    queryKey: ['flight-lookup', number, date],
    enabled: Boolean(number) && valid && signedIn && isSupabaseConfigured(),
    staleTime: 3_600_000,
    retry: false,
    queryFn: () => lookupFlight(number!, date!),
  });
  // Yazı değiştiyse ve henüz bekleme süresi dolmadıysa sonuç gösterilmez.
  const pending = normalizeFlightNumber(raw) !== number;
  return { number, info: pending ? undefined : query.data, loading: pending || query.isFetching, failed: query.isError && !pending };
}
