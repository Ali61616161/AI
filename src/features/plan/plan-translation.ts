import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { currentLanguage } from '@/i18n';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { applyTranslation, type PlanText, type PlanTranslation } from '../../../supabase/functions/_shared/plan-translation.ts';

/**
 * Plan başka bir dilde üretilmişse (ör. dil sonradan değiştirildi) metinleri uygulamanın diline çevirir. Çeviri
 * sunucuda (plan sürümü, dil) başına bir kez yapılır ve saklanır; plan zaten bu dildeyse boş döner. Çeviri yoksa
 * (internet, servis) plan olduğu gibi gösterilir.
 */
export function usePlanTranslation(tripId: string | undefined, versionId: string | undefined) {
  const language = currentLanguage();
  const signedIn = useSessionStore((s) => Boolean(s.session));
  return useQuery({
    queryKey: ['plan-translation', versionId, language],
    enabled: Boolean(tripId && versionId) && signedIn && isSupabaseConfigured(),
    staleTime: 7 * 24 * 3600_000,
    retry: false,
    queryFn: async (): Promise<PlanTranslation | null> => {
      const { data, error } = await getSupabase().functions.invoke('translate-plan', { body: { trip_id: tripId, language } });
      if (error) throw error;
      return (data as { translation: PlanTranslation | null } | null)?.translation ?? null;
    },
  });
}

/** Planı çeviriyle birleştirir; çeviri yoksa ya da plan zaten bu dildeyse aynı nesne döner. */
export function useTranslatedPlan<T extends PlanText & { id: string }>(tripId: string | undefined, plan: T | null | undefined): T | null | undefined {
  const translation = usePlanTranslation(tripId, plan?.id);
  const tr = translation.data;
  return useMemo(() => (plan ? applyTranslation(plan, tr) : plan), [plan, tr]);
}
