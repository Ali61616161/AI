import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { LanguagePicker } from '@/components/settings/language-picker';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { clearOfflineData } from '@/features/offline/download';
import { useCurrentPlan } from '@/features/subscription/purchases';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text variant="body" color="textSecondary">
        {label}
      </Text>
      <Text variant="bodyStrong" style={styles.rowValue}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const session = useSessionStore((s) => s.session);
  const preferences = useSessionStore((s) => s.preferences);
  const signOut = useSessionStore((s) => s.signOut);

  const email = session?.user.email;
  const initial = email?.[0]?.toUpperCase();
  const notSet = t('profile.notSet');
  const { data: plan } = useCurrentPlan();
  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly';

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);

  // Hesap ve tüm veriler sunucuda kalıcı olarak silinir, ardından çıkış yapılır.
  async function handleDelete() {
    setDeleting(true);
    setDeleteFailed(false);
    const { error } = await getSupabase().functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    setDeleting(false);
    if (error) {
      setDeleteFailed(true);
      return;
    }
    await getSupabase().auth.signOut().catch(() => undefined);
    clearOfflineData();
    signOut();
  }

  async function handleSignOut() {
    try {
      if (session && isSupabaseConfigured()) await getSupabase().auth.signOut();
    } finally {
      // Çıkış isteği başarısız olsa bile telefondaki seyahat verileri silinir.
      clearOfflineData();
      signOut();
    }
  }

  return (
    <Screen edges={['top']}>
      <Text variant="display">{t('profile.title')}</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.identity}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            {initial ? (
              <Text variant="title" style={{ color: colors.onPrimary }}>
                {initial}
              </Text>
            ) : (
              <Ionicons name="person" size={28} color={colors.onPrimary} />
            )}
          </View>
          <View style={styles.identityText}>
            <Text variant="subtitle">{email ?? t('profile.guest')}</Text>
            {!session && (
              <Text variant="caption" color="textSecondary">
                {t('profile.guestNote')}
              </Text>
            )}
          </View>
        </View>
        {!session && isSupabaseConfigured() && (
          <Button title={t('profile.createAccount')} variant="secondary" onPress={() => router.push('/sign-in')} />
        )}
      </View>

      {session && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/paywall')}
          style={[styles.card, styles.planRow, { backgroundColor: colors.surface, borderColor: isPro ? colors.border : colors.primary }]}>
          <Ionicons name="diamond-outline" size={22} color={colors.primary} />
          <View style={styles.identityText}>
            <Text variant="bodyStrong">{t('paywall.currentPlan', { plan: t(`paywall.plans.${plan ?? 'free'}` as 'paywall.plans.free') })}</Text>
            <Text variant="caption" color="textSecondary">
              {isPro ? t('paywall.manageHint') : t('paywall.upgradeHint')}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
        </Pressable>
      )}

      <View style={styles.section}>
        <Text variant="subtitle">{t('profile.preferences')}</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Row
            label={t('profile.companion')}
            value={preferences.companion ? t(`companion.${preferences.companion}`) : notSet}
          />
          <Row label={t('profile.budget')} value={preferences.budget ? t(`budget.${preferences.budget}`) : notSet} />
          <Row
            label={t('profile.interests')}
            value={
              preferences.interests.length
                ? preferences.interests.map((i) => t(`interest.${i}` as 'interest.art')).join(', ')
                : notSet
            }
          />
          <Button
            title={t('profile.editPreferences')}
            variant="secondary"
            onPress={() => router.push('/preferences')}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text variant="subtitle">{t('profile.language')}</Text>
        <LanguagePicker />
      </View>

      <View style={styles.section}>
        <Text variant="subtitle">{t('profile.account')}</Text>
        <Button title={t('legal.privacy')} variant="ghost" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
        <Button title={t('legal.terms')} variant="ghost" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
        <Button title={t('profile.signOut')} variant="ghost" onPress={handleSignOut} />
        {session && isSupabaseConfigured() && (
          <View style={[styles.danger, { borderColor: colors.danger }]}>
            {!confirmDelete ? (
              <Button title={t('profile.deleteAccount')} variant="ghost" onPress={() => setConfirmDelete(true)} />
            ) : (
              <>
                <Text variant="bodyStrong" color="danger">
                  {t('profile.deleteTitle')}
                </Text>
                <Text variant="caption" color="textSecondary">
                  {t('profile.deleteBody')}
                </Text>
                {deleteFailed && (
                  <Text variant="caption" color="danger">
                    {t('profile.deleteFailed')}
                  </Text>
                )}
                <Button title={t('profile.deleteConfirm')} loading={deleting} onPress={handleDelete} style={{ backgroundColor: colors.danger }} />
                <Button title={t('common.cancel')} variant="ghost" onPress={() => setConfirmDelete(false)} />
              </>
            )}
          </View>
        )}
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  planRow: { flexDirection: 'row', alignItems: 'center' },
  section: { gap: Spacing.md },
  card: { gap: Spacing.lg, padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityText: { flex: 1, gap: Spacing.xxs },
  avatar: { width: 56, height: 56, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg },
  rowValue: { flex: 1, textAlign: 'right' },
  center: { textAlign: 'center' },
});
