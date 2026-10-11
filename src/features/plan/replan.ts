import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { DateChangeAnalysis, StoredDay } from '../../../supabase/functions/_shared/replan.ts';
import type { PlanItem } from '../../../supabase/functions/_shared/itinerary.ts';

export type ReplanErrorCode = 'quota_exceeded' | 'ai_failed' | 'not_configured' | 'network';

export class ReplanError extends Error {
  constructor(readonly code: ReplanErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ReplanError';
  }
}

async function invokeReplan<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('replan', { body });
  if (error) {
    let code: ReplanErrorCode = 'network';
    if (error instanceof FunctionsHttpError) {
      const serverCode = (await error.context.json().catch(() => null))?.error?.code;
      code = serverCode === 'quota_exceeded' || serverCode === 'not_configured' ? serverCode : 'ai_failed';
    }
    throw new ReplanError(code, error.message);
  }
  return data as T;
}

/**
 * Konumu alır. İzin verilmezse veya alınamazsa null döner; asistan konumsuz da
 * çalışır (şehir bilgisini plandan alır).
 */
export async function getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60_000 });
    const position = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
    return { lat: position.coords.latitude, lng: position.coords.longitude };
  } catch {
    return null;
  }
}

export type CrisisResult = {
  reply: string;
  suggestions: PlanItem[];
  plan_version_id: string | null;
  previous_version_id: string | null;
  date: string;
};

export function useCrisisReplan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { message: string; tripId: string | null }) =>
      invokeReplan<CrisisResult>({
        mode: 'crisis',
        message: input.message,
        trip_id: input.tripId ?? undefined,
        location: await getCurrentLocation(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    onSuccess: (result, input) => {
      if (result.plan_version_id && input.tripId) {
        queryClient.invalidateQueries({ queryKey: ['plan', input.tripId] });
        queryClient.invalidateQueries({ queryKey: ['plan-versions', input.tripId] });
      }
    },
  });
}

export type DatesResult = {
  plan_version_id: string | null;
  previous_version_id: string | null;
  analysis: DateChangeAnalysis;
  removed: { date: string; title: string }[];
};

export function useChangeDates(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { start: string; end: string }) =>
      invokeReplan<DatesResult>({ mode: 'dates', trip_id: tripId, new_start: input.start, new_end: input.end }),
    onSuccess: () => invalidateTrip(queryClient, tripId),
  });
}

function invalidateTrip(queryClient: ReturnType<typeof useQueryClient>, tripId: string) {
  queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
  queryClient.invalidateQueries({ queryKey: ['trips'] });
  queryClient.invalidateQueries({ queryKey: ['plan', tripId] });
  queryClient.invalidateQueries({ queryKey: ['plan-versions', tripId] });
}

export type PlanVersionRow = {
  id: string;
  version: number;
  reason: 'initial' | 'dates_changed' | 'replan' | 'crisis' | 'manual_edit';
  summary: string | null;
  user_prompt: string | null;
  created_at: string;
  is_active: boolean;
  trip_start_date: string | null;
  trip_end_date: string | null;
};

export function usePlanVersions(tripId: string | undefined) {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['plan-versions', tripId],
    enabled: Boolean(userId && tripId) && isSupabaseConfigured(),
    queryFn: async (): Promise<PlanVersionRow[]> => {
      const { data, error } = await getSupabase()
        .from('plan_versions')
        .select('id, version, reason, summary, user_prompt, created_at, is_active, trip_start_date, trip_end_date')
        .eq('trip_id', tripId!)
        .order('version', { ascending: false });
      if (error) throw error;
      return data as PlanVersionRow[];
    },
  });
}

/** Bir sürümün günleri ve durak başlıkları (karşılaştırma için). */
export function usePlanVersionDays(versionId: string | null) {
  return useQuery({
    queryKey: ['plan-version-days', versionId],
    enabled: Boolean(versionId) && isSupabaseConfigured(),
    queryFn: async (): Promise<StoredDay[]> => {
      const { data, error } = await getSupabase()
        .from('day_plans')
        .select(
          'date, city, title, notes, plan_items(position, kind, title, description, starts_at, ends_at, timezone, place_name, address, ' +
            'category, estimated_cost, cost_currency, priority, is_indoor, is_locked, reservation_id, affiliate_partner)',
        )
        .eq('plan_version_id', versionId!)
        .order('date');
      if (error) throw error;
      return data as unknown as StoredDay[];
    },
  });
}

export function useRestoreVersion(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (versionId: string) => {
      const { error } = await getSupabase().rpc('restore_plan_version', { p_version_id: versionId });
      if (error) throw error;
    },
    onSuccess: () => invalidateTrip(queryClient, tripId),
  });
}
