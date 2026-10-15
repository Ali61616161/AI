import * as AppleAuthentication from 'expo-apple-authentication';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { currentLanguage } from '@/i18n';
import { useSessionStore } from '@/stores/session-store';
import { completeSignIn } from '@/features/auth/complete-sign-in';
import { LEGAL_VERSION } from '@/features/legal/content';
import { ConsentBox } from '@/features/legal/consent-box';
import { isAppleSignInAvailable, signInWithApple, signInWithGoogle, type SocialResult } from '@/features/auth/social-sign-in';
import { useTheme } from '@/theme/use-theme';
import { Radius, Spacing } from '@/theme/tokens';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { t } = useTranslation();
  const continueAsGuest = useSessionStore((s) => s.continueAsGuest);
  const isGuest = useSessionStore((s) => s.isGuest);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [withPassword, setWithPassword] = useState(false);
  const [password, setPassword] = useState('');
  const configured = isSupabaseConfigured();
  const saved = useSessionStore((s) => s.consents);
  const setConsents = useSessionStore((s) => s.setConsents);
  const [consent, setConsent] = useState({ accepted: saved?.version === LEGAL_VERSION, marketing: saved?.marketing ?? false });

  const { isDark } = useTheme();
  const [appleAvailable, setAppleAvailable] = useState(false);
  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  // Apple / Google: sözleşme onayı yine şart; iptal edilirse sessizce geri dönülür.
  async function social(run: () => Promise<SocialResult>) {
    setError(null);
    setLoading(true);
    rememberConsent();
    const result = await run();
    if ('session' in result) {
      await completeSignIn(result.session);
    } else if ('error' in result) {
      setError(t('auth.socialError'));
      console.warn('social sign-in failed', result.error);
    }
    setLoading(false);
  }

  // Onaylar telefonda tutulur, giriş tamamlanınca hesaba yazılır (complete-sign-in).
  function rememberConsent() {
    setConsents({ version: LEGAL_VERSION, marketing: consent.marketing });
  }

  // Şifreyle giriş: mağaza inceleme hesabı gibi e-posta kodu alamayan hesaplar için.
  async function signInWithPassword() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value) || !password) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setLoading(true);
    rememberConsent();
    const { data, error: signInError } = await getSupabase().auth.signInWithPassword({ email: value, password });
    if (signInError || !data.session) {
      setLoading(false);
      setError(t('auth.invalidPassword'));
      return;
    }
    await completeSignIn(data.session);
    setLoading(false);
  }

  async function sendCode() {
    const value = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(value)) {
      setError(t('auth.invalidEmail'));
      return;
    }
    setError(null);
    setLoading(true);
    rememberConsent();
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
          <Button
            title={withPassword ? t('auth.signInWithPassword') : t('auth.sendCode')}
            onPress={withPassword ? signInWithPassword : sendCode}
            loading={loading}
            disabled={!configured || !consent.accepted}
          />
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
      <StepHeader step={1} total={2} title={t('auth.signInTitle')} subtitle={withPassword ? t('auth.passwordSubtitle') : t('auth.signInSubtitle')} />
      {configured && (
        <View style={styles.social}>
          {appleAvailable && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={isDark ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={Radius.lg}
              style={[styles.appleButton, !consent.accepted && styles.disabled]}
              onPress={() => (consent.accepted ? social(signInWithApple) : setError(t('auth.acceptFirst')))}
            />
          )}
          <Button
            title={t('auth.continueWithGoogle')}
            icon="logo-google"
            variant="secondary"
            disabled={!consent.accepted || loading}
            onPress={() => social(signInWithGoogle)}
          />
          <Text variant="caption" color="textMuted" style={styles.or}>
            {t('auth.orWithEmail')}
          </Text>
        </View>
      )}
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
          returnKeyType={withPassword ? 'next' : 'send'}
          onSubmitEditing={withPassword ? undefined : sendCode}
        />
      ) : null}
      {configured && withPassword && (
        <TextField
          label={t('auth.passwordLabel')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={signInWithPassword}
        />
      )}
      {configured && <ConsentBox value={consent} onChange={setConsent} />}
      {configured ? (
        <Button title={withPassword ? t('auth.useCode') : t('auth.usePassword')} variant="ghost" onPress={() => setWithPassword((v) => !v)} />
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

const styles = StyleSheet.create({
  social: { gap: Spacing.sm },
  appleButton: { height: 52, width: '100%' },
  disabled: { opacity: 0.45 },
  or: { textAlign: 'center', marginTop: Spacing.xs },
});
