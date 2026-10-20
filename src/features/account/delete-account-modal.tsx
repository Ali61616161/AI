import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { getSupabase } from '@/lib/supabase';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Step = 'confirm' | 'password' | 'code';

/**
 * Hesap silme: önce ekranın ortasında onay penceresi, sonra kimlik doğrulama (şifre ya da
 * e-postaya gelen kod). Sadece doğrulama geçilirse silme isteği gönderilir.
 */
class DeleteFailed extends Error {}

export function DeleteAccountModal({ visible, email, hasPassword, onClose, onDeleted }: { visible: boolean; email: string; hasPassword: boolean; onClose: () => void; onDeleted: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [step, setStep] = useState<Step>('confirm');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep('confirm');
    setPassword('');
    setCode('');
    setError(null);
    setBusy(false);
  };
  const close = () => {
    reset();
    onClose();
  };

  async function deleteNow() {
    const { error: deleteError } = await getSupabase().functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    if (deleteError) throw new DeleteFailed();
    reset();
    onDeleted();
  }

  async function run(action: () => Promise<void>, failure: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(e instanceof DeleteFailed ? t('deleteAccount.deleteFailed') : failure);
    } finally {
      setBusy(false);
    }
  }

  const verifyPassword = () =>
    run(async () => {
      const { error: e } = await getSupabase().auth.signInWithPassword({ email, password });
      if (e) throw e;
      await deleteNow();
    }, t('deleteAccount.wrongPassword'));

  const sendCode = () =>
    run(async () => {
      const { error: e } = await getSupabase().auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (e) throw e;
      setCode('');
      setStep('code');
    }, t('deleteAccount.codeSendFailed'));

  const verifyCode = () =>
    run(async () => {
      const { error: e } = await getSupabase().auth.verifyOtp({ email, token: code.trim(), type: 'email' });
      if (e) throw e;
      await deleteNow();
    }, t('deleteAccount.wrongCode'));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : close} accessibilityLabel={t('common.cancel')} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
          {step === 'confirm' && (
            <>
              <Text variant="title" color="danger">
                {t('profile.deleteTitle')}
              </Text>
              <Text variant="body" color="textSecondary">
                {t('profile.deleteBody')}
              </Text>
              {error && (
                <Text variant="caption" color="danger">
                  {error}
                </Text>
              )}
              <Button title={t('deleteAccount.continue')} variant="danger" onPress={() => (hasPassword ? setStep('password') : sendCode())} loading={busy} />
              <Button title={t('common.cancel')} variant="ghost" onPress={close} />
            </>
          )}
          {step === 'password' && (
            <>
              <Text variant="title">{t('deleteAccount.verifyTitle')}</Text>
              <Text variant="body" color="textSecondary">
                {t('deleteAccount.passwordBody')}
              </Text>
              <TextField label={t('auth.passwordLabel')} value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" error={error} onSubmitEditing={verifyPassword} />
              <Button title={t('profile.deleteConfirm')} variant="danger" disabled={!password} loading={busy} onPress={verifyPassword} />
              <Button title={t('deleteAccount.useCode')} variant="secondary" disabled={busy} onPress={sendCode} />
              <Button title={t('common.cancel')} variant="ghost" onPress={close} />
            </>
          )}
          {step === 'code' && (
            <>
              <Text variant="title">{t('deleteAccount.verifyTitle')}</Text>
              <Text variant="body" color="textSecondary">
                {t('deleteAccount.codeBody', { email })}
              </Text>
              <TextField label={t('deleteAccount.code')} value={code} onChangeText={setCode} keyboardType="number-pad" autoComplete="one-time-code" maxLength={10} error={error} onSubmitEditing={verifyCode} />
              <Button title={t('profile.deleteConfirm')} variant="danger" disabled={code.trim().length < 4} loading={busy} onPress={verifyCode} />
              <Button title={t('deleteAccount.resend')} variant="secondary" disabled={busy} onPress={sendCode} />
              <Button title={t('common.cancel')} variant="ghost" onPress={close} />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg, backgroundColor: 'rgba(0,0,0,0.6)' },
  card: { width: '100%', maxWidth: 420, gap: Spacing.md, padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1 },
});
