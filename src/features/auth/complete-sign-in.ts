import type { Session } from '@supabase/supabase-js';
import { router } from 'expo-router';

import { saveIdentityToProfile, savePreferencesToProfile } from '@/features/profile/save-preferences';
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
    .select('default_companion, default_budget, interests, onboarding_completed_at, passport_country, other_passports, extra_visas, home_city, home_country, home_lat, home_lng')
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

  // Vatandaşlık ve şehir: sunucuda varsa o geçerli, yoksa telefondakini (misafirken girilen) yaz.
  if (profile?.passport_country) {
    store.setIdentity({
      passport: profile.passport_country,
      otherPassports: profile.other_passports ?? [],
      extraVisas: profile.extra_visas ?? [],
      homeCity: profile.home_city,
      homeCountry: profile.home_country,
      homeLat: profile.home_lat,
      homeLng: profile.home_lng,
    });
  } else if (store.identity.passport) {
    await saveIdentityToProfile(userId, store.identity);
  }
}

/** Kayıt ekranında onaylanan sözleşmeleri hesaba (sadece eklenen rıza kayıtları) yazar. */
async function recordConsents(userId: string) {
  const pending = useSessionStore.getState().consents;
  if (!pending) return;
  const { data: existing } = await getSupabase()
    .from('consents')
    .select('consent, granted, version')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  const latest = (c: string) => existing?.find((r) => r.consent === c);
  const rows: { consent: 'terms' | 'privacy' | 'marketing'; granted: boolean; version: string }[] = [];
  for (const c of ['terms', 'privacy'] as const) {
    if (latest(c)?.version !== pending.version || !latest(c)?.granted) rows.push({ consent: c, granted: true, version: pending.version });
  }
  if ((latest('marketing')?.granted ?? false) !== pending.marketing) rows.push({ consent: 'marketing', granted: pending.marketing, version: pending.version });
  if (rows.length) {
    const { error } = await getSupabase().from('consents').insert(rows);
    if (error) throw error;
  }
}

/** Oturumu kaydeder, tercihleri eşitler ve kullanıcıyı açabileceği ilk ekrana götürür. */
export async function completeSignIn(session: Session) {
  // Oturum dinleyicisini beklemeden kaydet; yönlendirme korumalı ekranları açık bulmalı.
  useSessionStore.getState().setSession(session);
  await syncPreferences(session.user.id).catch((e) => console.warn('Tercihler eşitlenemedi', e));
  await recordConsents(session.user.id).catch((e) => console.warn('Onaylar kaydedilemedi', e));
  // Giriş ve doğrulama ekranları korumasız olduğu için oturum açılınca kendiliğinden
  // kapanmazlar; kullanıcıyı açabileceği ilk ekrana açıkça yönlendiriyoruz.
  const { onboardingCompleted } = useSessionStore.getState();
  if (router.canDismiss()) router.dismissAll();
  router.replace(onboardingCompleted ? '/' : '/identity');
}
