import { useQuery } from '@tanstack/react-query';
import { getLocales } from 'expo-localization';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export type DealItem = { code: string; city: string; country_code: string | null; price: number; depart_on: string; return_on: string | null; airline: string | null; url: string };
export type DealsResult = { configured: boolean; origin: { code: string; name: string } | null; currency: string; deals: DealItem[] };

/** "Büyükçekmece, İstanbul" gibi "ilçe, il" etiketinden bilet aramasında kullanılacak şehir (son parça). */
export function dealsCityTerm(homeCity: string): string {
  const parts = homeCity.split(',').map((p) => p.trim()).filter(Boolean);
  return parts[parts.length - 1] ?? homeCity.trim();
}

/** Yaşanılan şehirden en ucuz uçuş bulunan yerler (3 saat önbellekli). Şehir seçilmemişse sorgu yapılmaz. */
export function useDeals(language: string) {
  const homeCity = useSessionStore((s) => s.identity.homeCity);
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const currency = getLocales()[0]?.currencyCode ?? 'EUR';
  const term = homeCity ? dealsCityTerm(homeCity) : null;
  return useQuery({
    queryKey: ['deals', term, currency, language],
    enabled: Boolean(term) && signedIn && isSupabaseConfigured(),
    staleTime: 3 * 3600_000,
    retry: false,
    queryFn: async (): Promise<DealsResult> => {
      const { data, error } = await getSupabase().functions.invoke('deals', { body: { city: term, currency, language } });
      if (error) throw error;
      return data as DealsResult;
    },
  });
}
