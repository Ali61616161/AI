import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { TextField } from '@/components/ui/text-field';
import { completeSignIn } from '@/features/auth/complete-sign-in';
import { getSupabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export default function VerifyScreen() {
  const { t } = useTranslation();
  const { email, mode } = useLocalSearchParams<{ email: string; mode?: 'signup' | 'reset' }>();
  const needsPassword = mode === 'signup' || mode === 'reset';
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
    setLoading(false);
    // Kayıt ve şifre sıfırlama: oturum açıldı, girişi tamamlamadan önce şifre belirlenir.
    if (needsPassword) {
      useSessionStore.getState().setSession(data.session);
      router.replace({ pathname: '/set-password', params: { mode } });
      return;
    }
    await completeSignIn(data.session);
  }

  async function resend() {
    await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: mode === 'signup' } });
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('auth.verify')} onPress={verify} loading={loading} disabled={code.trim().length < 6} />
          <Button title={t('auth.resend')} variant="ghost" onPress={resend} />
        </>
      }>
      <StepHeader step={2} total={needsPassword ? 3 : 2} title={t('auth.codeTitle')} subtitle={t('auth.codeSubtitle', { email })} />
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
