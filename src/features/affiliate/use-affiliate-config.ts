import { useQuery } from '@tanstack/react-query';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { AffiliateConfig } from '../../../supabase/functions/_shared/affiliate-config.ts';

/**
 * Ortaklık ayarları sunucudan gelir (eSIM şablonları, Amazon kimlikleri): ortaklık onayı gelince uygulamayı yeniden
 * derlemeden devreye girer. Alınamazsa null; bağlantılar düz (ortaklıksız) açılır.
 */
export function useAffiliateConfig() {
  const signedIn = useSessionStore((s) => Boolean(s.session));
  return useQuery({
    queryKey: ['affiliate-config'],
    enabled: signedIn && isSupabaseConfigured(),
    staleTime: 6 * 3600_000,
    retry: false,
    queryFn: async (): Promise<AffiliateConfig> => {
      const { data, error } = await getSupabase().functions.invoke('affiliate-config', { body: {} });
      if (error) throw error;
      return data as AffiliateConfig;
    },
  });
}
