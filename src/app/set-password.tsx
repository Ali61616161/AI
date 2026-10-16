import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { TextField } from '@/components/ui/text-field';
import { completeSignIn } from '@/features/auth/complete-sign-in';
import { getSupabase } from '@/lib/supabase';

export const MIN_PASSWORD_LENGTH = 8;

/** Kayıt veya şifre sıfırlamanın son adımı: e-posta kodu doğrulandı, şimdi şifre belirlenir. */
export default function SetPasswordScreen() {
  const { t } = useTranslation();
  const { mode } = useLocalSearchParams<{ mode?: 'signup' | 'reset' }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function save() {
    if (password.length < MIN_PASSWORD_LENGTH) return setError(t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH }));
    if (password !== confirm) return setError(t('auth.passwordMismatch'));
    setError(null);
    setLoading(true);
    const { data, error: updateError } = await getSupabase().auth.updateUser({ password });
    const { data: current } = await getSupabase().auth.getSession();
    if (updateError || !data.user || !current.session) {
      setLoading(false);
      setError(updateError?.code === 'weak_password' ? t('auth.passwordTooShort', { count: MIN_PASSWORD_LENGTH }) : t('auth.passwordSaveError'));
      return;
    }
    await completeSignIn(current.session);
    setLoading(false);
  }

  return (
    <Screen footer={<Button title={t('auth.savePassword')} onPress={save} loading={loading} disabled={!password || !confirm} />}>
      <StepHeader
        step={3}
        total={3}
        title={mode === 'reset' ? t('auth.newPasswordTitle') : t('auth.setPasswordTitle')}
        subtitle={t('auth.setPasswordSubtitle', { count: MIN_PASSWORD_LENGTH })}
      />
      <TextField
        label={t('auth.passwordLabel')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        autoFocus
        returnKeyType="next"
      />
      <TextField
        label={t('auth.confirmPasswordLabel')}
        value={confirm}
        onChangeText={setConfirm}
        error={error}
        secureTextEntry
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="done"
        onSubmitEditing={save}
      />
    </Screen>
  );
}
