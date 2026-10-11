import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { TextField } from '@/components/ui/text-field';
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

export default function VerifyScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify() {
    setError(null);
    setLoading(true);
    const { data, error: verifyError } = await getSupabase().auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });
    if (verifyError || !data.user || !data.session) {
      setLoading(false);
      setError(t('auth.invalidCode'));
      return;
    }
    // Oturum dinleyicisini beklemeden kaydet; yönlendirme korumalı ekranları açık bulmalı.
    useSessionStore.getState().setSession(data.session);
    await syncPreferences(data.user.id).catch((e) => console.warn('Tercihler eşitlenemedi', e));
    setLoading(false);
    // Giriş ve doğrulama ekranları korumasız olduğu için oturum açılınca kendiliğinden
    // kapanmazlar; kullanıcıyı açabileceği ilk ekrana açıkça yönlendiriyoruz.
    const { onboardingCompleted } = useSessionStore.getState();
    if (router.canDismiss()) router.dismissAll();
    router.replace(onboardingCompleted ? '/' : '/companion');
  }

  async function resend() {
    await getSupabase().auth.signInWithOtp({ email });
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('auth.verify')} onPress={verify} loading={loading} disabled={code.trim().length < 6} />
          <Button title={t('auth.resend')} variant="ghost" onPress={resend} />
        </>
      }>
      <StepHeader step={2} total={2} title={t('auth.codeTitle')} subtitle={t('auth.codeSubtitle', { email })} />
      <TextField
        label={t('auth.codeLabel')}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
        error={error}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        style={{ letterSpacing: 8, fontSize: 24 }}
      />
    </Screen>
  );
}
