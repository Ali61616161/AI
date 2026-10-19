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
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
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

  function switchMode(next: typeof mode) {
    setMode(next);
    setError(null);
    setPassword('');
  }

  // Onaylar telefonda tutulur, giriş tamamlanınca hesaba yazılır (complete-sign-in).
  function rememberConsent() {
    setConsents({ version: LEGAL_VERSION, marketing: consent.marketing });
  }

  // Giriş: e-posta + şifre. Kayıt ve şifre sıfırlama: e-postaya kod → yeni şifre (set-password).
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
      // Şifre sıfırlamada yeni hesap açılmaz; kayıtlı olmayan e-postaya kod gitmez.
      options: { shouldCreateUser: mode === 'signup', data: { language: currentLanguage() } },
    });
    setLoading(false);
    if (otpError) {
      // Hesap bulunamadı: hangi e-postaların kayıtlı olduğu belli olmasın diye genel mesaj.
      setError(mode === 'reset' ? t('auth.resetError') : otpError.message);
      return;
    }
    router.push({ pathname: '/verify', params: { email: value, mode } });
  }

  const primary = mode === 'signin' ? signInWithPassword : sendCode;
  const title = mode === 'signin' ? t('auth.signInTitle') : mode === 'signup' ? t('auth.signUpTitle') : t('auth.resetTitle');
  const subtitle = mode === 'signin' ? t('auth.signInSubtitle') : mode === 'signup' ? t('auth.signUpSubtitle') : t('auth.resetSubtitle');

  return (
    <Screen
      footer={
        <>
          <Button
            title={mode === 'signin' ? t('auth.signInWithPassword') : t('auth.sendCode')}
            onPress={primary}
            loading={loading}
            disabled={!configured || !consent.accepted}
          />
        </>
      }>
      <StepHeader step={1} total={mode === 'signin' ? 1 : 3} title={title} subtitle={subtitle} />
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
          returnKeyType={mode === 'signin' ? 'next' : 'send'}
          onSubmitEditing={mode === 'signin' ? undefined : sendCode}
        />
      ) : null}
      {configured && mode === 'signin' && (
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
        <View style={styles.links}>
          {mode === 'signin' && <Button title={t('auth.forgotPassword')} variant="ghost" onPress={() => switchMode('reset')} />}
          <Button
            title={mode === 'signup' ? t('auth.haveAccount') : mode === 'signin' ? t('auth.noAccount') : t('auth.backToSignIn')}
            variant="ghost"
            onPress={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          />
        </View>
      ) : (
        <Text variant="body" color="warning">
          {t('auth.notConfigured')}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  social: { gap: Spacing.sm },
  appleButton: { height: 52, width: '100%' },
  disabled: { opacity: 0.45 },
  links: { gap: Spacing.xs },
  or: { textAlign: 'center', marginTop: Spacing.xs },
});
