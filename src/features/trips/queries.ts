import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { TripDraft } from '@/features/documents/build-trip';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import type { Json } from '@/types/database';

const TRIP_LIST_SELECT =
  'id, title, status, start_date, end_date, trip_destinations(city, country_code, position), reservations(count)';

const TRIP_DETAIL_SELECT =
  'id, title, status, start_date, end_date, budget_tier, companion_type, ' +
  'trip_destinations(id, city, country_code, arrive_on, depart_on, position), ' +
  'reservations(id, type, title, provider_name, reference_code, starts_at, ends_at, start_timezone, end_timezone, ' +
  'origin_name, origin_code, destination_name, destination_code, address, details)';

function useUserId() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

export function useTrips() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['trips', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('trips')
        .select(TRIP_LIST_SELECT)
        .neq('status', 'cancelled')
        .order('start_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data.map((trip) => ({
        ...trip,
        trip_destinations: [...trip.trip_destinations].sort((a, b) => a.position - b.position),
        reservation_count: trip.reservations[0]?.count ?? 0,
      }));
    },
  });
}

export type TripListItem = NonNullable<ReturnType<typeof useTrips>['data']>[number];

export function useTrip(tripId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['trip', tripId],
    enabled: Boolean(userId && tripId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('trips').select(TRIP_DETAIL_SELECT).eq('id', tripId!).single();
      if (error) throw error;
      const trip = data as unknown as TripDetail;
      return {
        ...trip,
        trip_destinations: [...trip.trip_destinations].sort((a, b) => a.position - b.position),
        reservations: [...trip.reservations].sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      };
    },
  });
}

export type TripReservation = {
  id: string;
  type: 'flight' | 'hotel' | 'train' | 'bus' | 'car_rental' | 'event' | 'other';
  title: string;
  provider_name: string | null;
  reference_code: string | null;
  starts_at: string;
  ends_at: string | null;
  start_timezone: string | null;
  end_timezone: string | null;
  origin_name: string | null;
  origin_code: string | null;
  destination_name: string | null;
  destination_code: string | null;
  address: string | null;
  details: Record<string, unknown>;
};

export type TripDetail = {
  id: string;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  budget_tier: string;
  companion_type: string;
  trip_destinations: {
    id: string;
    city: string;
    country_code: string | null;
    arrive_on: string | null;
    depart_on: string | null;
    position: number;
  }[];
  reservations: TripReservation[];
};

/** Onaylanan belgelerden seyahat oluşturur (veya tripId verilirse mevcut seyahate ekler). */
export function useCreateTripFromDocuments() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { draft: TripDraft; documentIds: string[]; tripId?: string }) => {
      const { preferences } = useSessionStore.getState();
      const { data, error } = await getSupabase().rpc('create_trip_from_documents', {
        p_trip: {
          title: input.draft.title,
          start_date: input.draft.start_date,
          end_date: input.draft.end_date,
          companion_type: preferences.companion,
          budget_tier: preferences.budget,
          interests: preferences.interests,
        },
        p_destinations: input.draft.destinations as unknown as Json,
        p_reservations: input.draft.reservations as unknown as Json,
        p_document_ids: input.documentIds,
        p_trip_id: input.tripId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (tripId) => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
    },
  });
}
