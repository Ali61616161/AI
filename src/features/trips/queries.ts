import { FunctionsHttpError } from '@supabase/supabase-js';
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

export type PlanItemRow = {
  id: string;
  position: number;
  kind: 'activity' | 'meal' | 'transport' | 'accommodation' | 'free_time' | 'reservation';
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  place_name: string | null;
  address: string | null;
  category: string | null;
  estimated_cost: number | null;
  cost_currency: string | null;
  priority: number;
  is_indoor: boolean | null;
  is_locked: boolean;
  reservation_id: string | null;
  affiliate_partner: string | null;
  status: 'planned' | 'visited' | 'skipped';
};

export type PlanDayRow = {
  id: string;
  date: string;
  city: string | null;
  title: string | null;
  notes: string | null;
  plan_items: PlanItemRow[];
};

export type ActivePlan = {
  id: string;
  version: number;
  reason: string;
  summary: string | null;
  created_at: string;
  day_plans: PlanDayRow[];
};

const PLAN_SELECT =
  'id, version, reason, summary, created_at, day_plans(id, date, city, title, notes, plan_items(' +
  'id, position, kind, title, description, starts_at, ends_at, timezone, place_name, address, category, ' +
  'estimated_cost, cost_currency, priority, is_indoor, is_locked, reservation_id, affiliate_partner, status))';

/** Seyahatin aktif plan sürümü; günler tarihe, kalemler sıraya göre dizili. Plan yoksa null. */
export function useActivePlan(tripId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['plan', tripId],
    enabled: Boolean(userId && tripId) && isSupabaseConfigured(),
    queryFn: async (): Promise<ActivePlan | null> => {
      const { data, error } = await getSupabase()
        .from('plan_versions')
        .select(PLAN_SELECT)
        .eq('trip_id', tripId!)
        .eq('is_active', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const plan = data as unknown as ActivePlan;
      return {
        ...plan,
        day_plans: [...plan.day_plans]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((d) => ({ ...d, plan_items: [...d.plan_items].sort((a, b) => a.position - b.position) })),
      };
    },
  });
}

export type GenerateErrorCode = 'quota_exceeded' | 'ai_failed' | 'not_configured' | 'no_dates' | 'network';

export class GenerateError extends Error {
  constructor(readonly code: GenerateErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'GenerateError';
  }
}

/** Sunucuda AI ile rota üretir; başarılı olursa aktif plan yeniden yüklenir. */
export function useGenerateItinerary(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await getSupabase().functions.invoke('generate-itinerary', { body: { trip_id: tripId } });
      if (error) {
        let code: GenerateErrorCode = 'network';
        if (error instanceof FunctionsHttpError) {
          const body = await error.context.json().catch(() => null);
          const serverCode = body?.error?.code;
          const message: string | undefined = body?.error?.message;
          code =
            serverCode === 'quota_exceeded' || serverCode === 'not_configured' || serverCode === 'ai_failed'
              ? serverCode
              : message?.includes('no dates')
                ? 'no_dates'
                : 'ai_failed';
        }
        throw new GenerateError(code, error.message);
      }
      return data as { plan_version_id: string; days_planned: number; days_total: number; truncated: boolean };
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', tripId] }),
  });
}
