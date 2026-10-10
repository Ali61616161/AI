import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { currentLanguage } from '@/i18n';
import { useSessionStore } from '@/stores/session-store';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { t } = useTranslation();
  const continueAsGuest = useSessionStore((s) => s.continueAsGuest);
  const isGuest = useSessionStore((s) => s.isGuest);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const configured = isSupabaseConfigured();

  async function sendCode() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setLoading(true);
    const { error: otpError } = await getSupabase().auth.signInWithOtp({
      email: value,
      // Yeni kullanıcının profili bu dille oluşturulur (handle_new_user tetikleyicisi).
      options: { data: { language: currentLanguage() } },
    });
    setLoading(false);
    if (otpError) {
      setError(otpError.message);
      return;
    }
    router.push({ pathname: '/verify', params: { email: value } });
  }

  return (
    <Screen
      footer={
        <>
          <Button title={t('auth.sendCode')} onPress={sendCode} loading={loading} disabled={!configured} />
          {!isGuest && (
            <Button
              title={t('auth.guest')}
              variant="ghost"
              onPress={() => {
                continueAsGuest();
                if (router.canGoBack()) router.back();
              }}
            />
          )}
        </>
      }>
      <StepHeader step={1} total={2} title={t('auth.signInTitle')} subtitle={t('auth.signInSubtitle')} />
      {configured ? (
        <TextField
          label={t('auth.emailLabel')}
          placeholder={t('auth.emailPlaceholder')}
          value={email}
          onChangeText={setEmail}
          error={error}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={sendCode}
        />
      ) : (
        <Text variant="body" color="warning">
          {t('auth.notConfigured')}
        </Text>
      )}
      <Text variant="caption" color="textMuted">
        {t('auth.guestHint')}
      </Text>
    </Screen>
  );
}
