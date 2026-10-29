import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { notePositiveMoment } from '@/features/engagement/rating';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useTranslatedTexts } from '@/features/translate/use-translated-texts';
import { useSessionStore } from '@/stores/session-store';

import type { ReportInsights, TripStats } from '../../../supabase/functions/_shared/report.ts';

export type { ReportInsights, TripStats };

export type TripReportRow = {
  trip_id: string;
  stats: TripStats & { currency?: string };
  overall_rating: number | null;
  route_rating: number | null;
  feedback: string | null;
  ai_insights: ReportInsights | null;
  generated_at: string;
};

function useEnabled(extra: boolean) {
  return useSessionStore((s) => Boolean(s.session)) && isSupabaseConfigured() && extra;
}

export function useTripReport(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-report', tripId],
    enabled: useEnabled(Boolean(tripId)),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('trip_reports')
        .select('trip_id, stats, overall_rating, route_rating, feedback, ai_insights, generated_at')
        .eq('trip_id', tripId!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as TripReportRow | null;
    },
  });
}

export function useGenerateReport(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { overallRating: number | null; routeRating: number | null; feedback: string }) => {
      const { data, error } = await getSupabase().functions.invoke('trip-report', {
        body: { trip_id: tripId, overall_rating: input.overallRating ?? undefined, route_rating: input.routeRating ?? undefined, feedback: input.feedback },
      });
      if (error) throw error;
      return data as { ai_failed: boolean };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trip-report', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      notePositiveMoment();
    },
  });
}

export function usePlaceRatings(tripId: string | undefined) {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['place-ratings', tripId, userId],
    enabled: useEnabled(Boolean(tripId && userId)),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('place_ratings').select('plan_item_id, rating').eq('trip_id', tripId!).eq('user_id', userId!);
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.plan_item_id as string, r.rating as number]));
    },
  });
}

/** Mekanı puanlar ve "gidildi" işaretler; rating null ise "atlandı" işaretler ve puanı siler. */
export function useRatePlace(tripId: string) {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (input: { itemId: string; placeName: string; googlePlaceId: string | null; rating: number | null }) => {
      const supabase = getSupabase();
      if (input.rating === null) {
        const { error } = await supabase.from('place_ratings').delete().eq('plan_item_id', input.itemId).eq('user_id', userId!);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('place_ratings').upsert(
          { trip_id: tripId, plan_item_id: input.itemId, place_name: input.placeName, google_place_id: input.googlePlaceId, rating: input.rating },
          { onConflict: 'user_id,plan_item_id' },
        );
        if (error) throw error;
      }
      const { error: statusError } = await supabase
        .from('plan_items')
        .update({ status: input.rating === null ? 'skipped' : 'visited', visited_at: input.rating === null ? null : new Date().toISOString() })
        .eq('id', input.itemId);
      if (statusError) throw statusError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['place-ratings', tripId, userId] });
      queryClient.invalidateQueries({ queryKey: ['plan', tripId] });
    },
  });
}

/** Raporun yapay zekâ metinlerini (özet, öne çıkanlar, sonraki seyahat ipucu) uygulamanın diline çevirir; rapor başka dilde üretilmiş olabilir. */
export function useTranslatedReport(report: TripReportRow | null | undefined): TripReportRow | null | undefined {
  const insights = report?.ai_insights;
  const highlights = insights?.highlights ?? [];
  const out = useTranslatedTexts([insights?.summary, insights?.nextTripTip, ...highlights]);
  if (!report || !insights) return report;
  return {
    ...report,
    ai_insights: {
      ...insights,
      summary: out[0] ?? insights.summary,
      nextTripTip: out[1] ?? insights.nextTripTip,
      highlights: highlights.map((h, i) => out[2 + i] ?? h),
    },
  };
}
