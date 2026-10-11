import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { savePreferencesToProfile } from '@/features/profile/save-preferences';
import { getSupabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

/**
 * Giriş başarılı olunca tercihleri birleştirir:
 * - Sunucuda tamamlanmış onboarding varsa (ör. yeni telefon) onu telefona alır.
 * - Yoksa ve kullanıcı misafirken onboarding'i bitirdiyse, tercihlerini hesabına yazar.
 */
async function syncPreferences(userId: string) {
  const store = useSessionStore.getState();
  const { data: profile } = await getSupabase()
    .from('profiles')
    .select('default_companion, default_budget, interests, onboarding_completed_at')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.onboarding_completed_at) {
    store.setPreferences({
      companion: profile.default_companion,
      budget: profile.default_budget,
      interests: profile.interests,
    });
    store.completeOnboarding();
  } else if (store.onboardingCompleted) {
    await savePreferencesToProfile(userId, store.preferences);
  }
}

/** Oturumu kaydeder, tercihleri eşitler ve kullanıcıyı açabileceği ilk ekrana götürür. */
export async function completeSignIn(session: Session) {
  // Oturum dinleyicisini beklemeden kaydet; yönlendirme korumalı ekranları açık bulmalı.
  useSessionStore.getState().setSession(session);
  await syncPreferences(session.user.id).catch((e) => console.warn('Tercihler eşitlenemedi', e));
  // Giriş ve doğrulama ekranları korumasız olduğu için oturum açılınca kendiliğinden
  // kapanmazlar; kullanıcıyı açabileceği ilk ekrana açıkça yönlendiriyoruz.
  const { onboardingCompleted } = useSessionStore.getState();
  if (router.canDismiss()) router.dismissAll();
  router.replace(onboardingCompleted ? '/' : '/companion');
}
