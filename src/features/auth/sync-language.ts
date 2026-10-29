import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { currentLanguage } from '@/i18n';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

/**
 * Sunucudaki profil dili (AI rotaları, mekan açıklamaları ve hava metni bu dilde üretilir) uygulamanın diliyle aynı
 * tutulur. Dil yalnızca kayıtta yazılıyordu; sonradan değiştirince yeni içerik eski dilde gelmeye devam ediyordu.
 */
export async function syncPreferredLanguage(userId: string | null, language = currentLanguage()): Promise<void> {
  if (!userId || !isSupabaseConfigured()) return;
  try {
    await getSupabase().from('profiles').update({ preferred_language: language }).eq('id', userId).neq('preferred_language', language);
  } catch {
    // Çevrimdışıyken sessizce geçilir; sonraki açılışta yeniden denenir.
  }
}

/** Oturum açıkken ve dil değişince profil dilini eşitler. */
export function usePreferredLanguageSync(): void {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  const { i18n } = useTranslation();
  useEffect(() => {
    syncPreferredLanguage(userId, currentLanguage());
  }, [userId, i18n.language]);
}
