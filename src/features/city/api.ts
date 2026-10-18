import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notePositiveMoment } from '@/features/engagement/rating';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { Getaway, Mood, StopKind, Transport, When } from '../../../supabase/functions/_shared/city.ts';
import type { TicketOption } from '../../../supabase/functions/_shared/transport.ts';

export type { Mood, StopKind, Transport, When };

export type EveningStop = {
  time: string;
  duration_min: number | null;
  kind: StopKind;
  title: string;
  place_name: string;
  neighborhood: string | null;
  why: string;
  est_cost: number | null;
  indoor: boolean | null;
  google_place_id: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  rating_count: number | null;
  maps_url: string | null;
};

export type EveningPlan = {
  city: string;
  currency: string;
  title: string;
  summary: string;
  weather: { temperature: number | null; description: string | null; rainChance: number | null } | null;
  stops: EveningStop[];
};

export type GetawayResult = Getaway & { directionsUrl: string; tickets?: TicketOption[] };
export type GetawaysResponse = { city: string; currency: string; days: number; budget_per_person: number; getaways: GetawayResult[] };

export type CityErrorCode = 'quota_exceeded' | 'not_configured' | 'no_home_city' | 'ai_failed' | 'network';

export class CityError extends Error {
  constructor(readonly code: CityErrorCode) {
    super(code);
    this.name = 'CityError';
  }
}

async function invokeCity<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('city', { body });
  if (error) {
    let code: CityErrorCode = 'network';
    if (error instanceof FunctionsHttpError) {
      const e = (await error.context.json().catch(() => null))?.error;
      code = e?.message === 'no_home_city' ? 'no_home_city' : e?.code === 'quota_exceeded' || e?.code === 'not_configured' ? e.code : 'ai_failed';
    }
    throw new CityError(code);
  }
  return data as T;
}

export function useEveningPlan() {
  return useMutation({
    mutationFn: (input: { when: When; companion: string; budget: string; moods: Mood[]; budget_amount?: number; note?: string; lat?: number; lng?: number }) =>
      invokeCity<EveningPlan>({ action: 'evening', ...input, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
    onSuccess: () => notePositiveMoment(),
  });
}

export function useGetaways() {
  return useMutation({
    mutationFn: (input: { days: number; budget_per_person: number; transport: Transport; companion: string; note?: string; exclude?: string[] }) =>
      invokeCity<GetawaysResponse>({ action: 'getaways', ...input }),
  });
}

// ---------------------------------------------------------------------------
// Kayıtlı yerler ve şehir pasaportu
// ---------------------------------------------------------------------------

export type SavedPlace = {
  id: string;
  list_name: string;
  google_place_id: string;
  name: string;
  category: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  maps_url: string | null;
  created_at: string;
};

export type PlaceInput = { google_place_id: string; name: string; category?: string | null; address?: string | null; lat?: number | null; lng?: number | null; maps_url?: string | null };

function useUserId() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

export function useSavedPlaces() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['saved-places', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('saved_places').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as SavedPlace[];
    },
  });
}

export class SaveLimitError extends Error {
  constructor(readonly code: 'pro_required' | 'limit_reached') {
    super(code);
  }
}

export function useSavePlace() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async ({ place, list = 'want' }: { place: PlaceInput; list?: string }) => {
      const { error } = await getSupabase()
        .from('saved_places')
        .upsert({ ...place, list_name: list }, { onConflict: 'user_id,list_name,google_place_id', ignoreDuplicates: true });
      if (error) {
        if (error.message.includes('pro_required')) throw new SaveLimitError('pro_required');
        if (error.message.includes('limit_reached')) throw new SaveLimitError('limit_reached');
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-places', userId] }),
  });
}

export function useRemoveSaved() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('saved_places').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['saved-places', userId] }),
  });
}

export type Visit = { id: string; google_place_id: string; name: string; category: string | null; city: string | null; visited_on: string };
export type PassportStats = { places: number; visits: number; categories: number; this_month: number; week_streak: number };

export function useVisits() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['visits', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('place_visits').select('id, google_place_id, name, category, city, visited_on').order('visited_on', { ascending: false }).limit(200);
      if (error) throw error;
      return data as Visit[];
    },
  });
}

export function useCityStats() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['city-stats', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('city_passport_stats').maybeSingle();
      if (error) throw error;
      return (data ?? { places: 0, visits: 0, categories: 0, this_month: 0, week_streak: 0 }) as PassportStats;
    },
  });
}

export function useMarkVisited() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  const city = useSessionStore((s) => s.identity.homeCity);
  return useMutation({
    mutationFn: async (place: PlaceInput) => {
      const { error } = await getSupabase()
        .from('place_visits')
        .upsert(
          { google_place_id: place.google_place_id, name: place.name, category: place.category ?? null, lat: place.lat ?? null, lng: place.lng ?? null, city },
          { onConflict: 'user_id,google_place_id,visited_on', ignoreDuplicates: true },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visits', userId] });
      queryClient.invalidateQueries({ queryKey: ['city-stats', userId] });
    },
  });
}

/** Rozetler istatistikten hesaplanır (sunucuda ayrıca saklanmaz). */
export const BADGES = [
  { key: 'first', icon: 'footsteps', reached: (s: PassportStats) => s.places >= 1 },
  { key: 'explorer5', icon: 'compass', reached: (s: PassportStats) => s.places >= 5 },
  { key: 'local15', icon: 'map', reached: (s: PassportStats) => s.places >= 15 },
  { key: 'legend40', icon: 'trophy', reached: (s: PassportStats) => s.places >= 40 },
  { key: 'variety', icon: 'color-palette', reached: (s: PassportStats) => s.categories >= 5 },
  { key: 'streak3', icon: 'flame', reached: (s: PassportStats) => s.week_streak >= 3 },
  { key: 'streak8', icon: 'rocket', reached: (s: PassportStats) => s.week_streak >= 8 },
] as const;
