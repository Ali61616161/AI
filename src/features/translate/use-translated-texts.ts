import { useQuery } from '@tanstack/react-query';

import { currentLanguage } from '@/i18n';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

/**
 * Başka dilde saklanmış kısa metinleri (rapor özeti, günlük notları…) uygulamanın diline çevirir. Çeviri sunucuda metin
 * başına bir kez yapılıp saklanır; çeviri gelene kadar ya da hata olursa özgün metinler aynen döner (sıra korunur).
 */
export function useTranslatedTexts(texts: readonly (string | null | undefined)[]): (string | null | undefined)[] {
  const language = currentLanguage();
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const wanted = [...new Set(texts.map((t) => t?.trim()).filter((t): t is string => Boolean(t)))].slice(0, 60);
  const query = useQuery({
    queryKey: ['text-translation', language, wanted],
    enabled: wanted.length > 0 && signedIn && isSupabaseConfigured(),
    staleTime: 7 * 24 * 3600_000,
    retry: false,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await getSupabase().functions.invoke('translate-texts', { body: { texts: wanted, language } });
      if (error) throw error;
      const list = (data as { texts?: unknown } | null)?.texts;
      if (!Array.isArray(list) || list.length !== wanted.length) throw new Error('translate-texts: unexpected response');
      return list.map(String);
    },
  });
  const done = query.data;
  if (!done) return [...texts];
  const map = new Map(wanted.map((t, i) => [t, done[i]]));
  return texts.map((t) => (t?.trim() ? (map.get(t.trim()) ?? t) : t));
}
