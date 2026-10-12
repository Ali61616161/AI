import Ionicons from '@expo/vector-icons/Ionicons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LanguagePicker } from '@/components/settings/language-picker';
import { Button } from '@/components/ui/button';
import { DirIcon } from '@/components/ui/dir-icon';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { adPrivacyOptionsAvailable, openAdPrivacyOptions } from '@/features/ads/privacy-options';
import { PassportCard } from '@/features/identity/passport-card';
import { usePassportPower } from '@/features/identity/use-passport-power';
import { clearOfflineData } from '@/features/offline/download';
import { useCurrentPlan } from '@/features/subscription/purchases';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useAppearanceStore, type Appearance } from '@/stores/appearance-store';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
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
  const identity = useSessionStore((s) => s.identity);
  const power = usePassportPower(identity);
  const signOut = useSessionStore((s) => s.signOut);
  const appearance = useAppearanceStore((s) => s.appearance);
  const setAppearance = useAppearanceStore((s) => s.setAppearance);

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

  const appearanceOptions: { key: Appearance; icon: 'moon' | 'sunny' | 'phone-portrait-outline' }[] = [
    { key: 'dark', icon: 'moon' },
    { key: 'light', icon: 'sunny' },
    { key: 'system', icon: 'phone-portrait-outline' },
  ];

  return (
    <Screen edges={['top']} tabBarSpace>
      <Text variant="display">{t('profile.title')}</Text>

      <Card variant="glow" gradient={Gradients.accent}>
        <View style={styles.identity}>
          <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            {initial ? (
              <Text variant="title" style={styles.white}>
                {initial}
              </Text>
            ) : (
              <Ionicons name="person" size={28} color="#FFFFFF" />
            )}
          </LinearGradient>
          <View style={styles.identityText}>
            <Text variant="overline" color="textMuted">
              {session ? t('profile.account') : t('profile.guest')}
            </Text>
            <Text variant="bodyStrong" numberOfLines={1} ellipsizeMode="middle">
              {email ?? t('profile.guest')}
            </Text>
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
      </Card>

      {session && (
        <Card variant={isPro ? 'glass' : 'gradient'} onPress={() => router.push('/paywall')} accessibilityLabel={t('paywall.currentPlan', { plan: t(`paywall.plans.${plan ?? 'free'}` as 'paywall.plans.free') })}>
          <View style={styles.identity}>
            <View style={[styles.planIcon, { backgroundColor: isPro ? colors.surfaceMuted : 'rgba(255,255,255,0.2)' }]}>
              <Ionicons name="diamond" size={22} color={isPro ? colors.primary : '#FFFFFF'} />
            </View>
            <View style={styles.identityText}>
              <Text variant="bodyStrong" style={!isPro && styles.white}>
                {t('paywall.currentPlan', { plan: t(`paywall.plans.${plan ?? 'free'}` as 'paywall.plans.free') })}
              </Text>
              <Text variant="caption" style={!isPro ? styles.whiteSoft : { color: colors.textSecondary }}>
                {isPro ? t('paywall.manageHint') : t('paywall.upgradeHint')}
              </Text>
            </View>
            <DirIcon name="chevron-forward" size={18} color={isPro ? colors.textSecondary : '#FFFFFF'} />
          </View>
        </Card>
      )}

      <View style={styles.section}>
        <SectionHeader title={t('passport.title')} action={t('passport.open')} onAction={() => router.push('/passport')} />
        {power ? (
          <PassportCard passports={[identity.passport, ...identity.otherPassports].filter((p): p is string => !!p)} power={power} onPress={() => router.push('/passport')} />
        ) : (
          <Card variant="glow" onPress={() => router.push('/passport')} accessibilityLabel={t('passport.addTitle')}>
            <View style={styles.identity}>
              <IconBadge icon="earth" size={46} />
              <View style={styles.identityText}>
                <Text variant="bodyStrong">{t('passport.addTitle')}</Text>
                <Text variant="caption" color="textSecondary">
                  {t('passport.addBody')}
                </Text>
              </View>
              <DirIcon name="chevron-forward" size={18} color={colors.textSecondary} />
            </View>
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.preferences')} action={t('profile.editPreferences')} onAction={() => router.push('/preferences')} />
        <Card>
          <Row label={t('profile.companion')} value={preferences.companion ? t(`companion.${preferences.companion}`) : notSet} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row label={t('profile.budget')} value={preferences.budget ? t(`budget.${preferences.budget}`) : notSet} />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Row
            label={t('profile.interests')}
            value={preferences.interests.length ? preferences.interests.map((i) => t(`interest.${i}` as 'interest.art')).join(', ') : notSet}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.appearance')} />
        <View style={[styles.segment, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityRole="radiogroup">
          {appearanceOptions.map((o) => {
            const active = appearance === o.key;
            return (
              <Tap key={o.key} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setAppearance(o.key)} feedback="select" style={styles.flex}>
                <View style={[styles.segmentItem, active && { backgroundColor: colors.surfaceStrong }]}>
                  <Ionicons name={o.icon} size={16} color={active ? colors.primary : colors.textSecondary} />
                  <Text variant="caption" color={active ? 'text' : 'textSecondary'}>
                    {t(`profile.appearanceOptions.${o.key}`)}
                  </Text>
                </View>
              </Tap>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.language')} />
        <LanguagePicker />
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('profile.account')} />
        <Card padding={Spacing.xs}>
          <ListRow icon="earth-outline" label={t('visited.title')} onPress={() => router.push('/visited')} />
          <ListRow icon="document-text-outline" label={t('docs.title')} onPress={() => router.push('/my-docs')} />
          <ListRow icon="shield-checkmark-outline" label={t('legal.privacy')} onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
          <ListRow icon="document-text-outline" label={t('legal.terms')} onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
          <ListRow icon="reader-outline" label={t('legal.kvkk')} onPress={() => router.push({ pathname: '/legal', params: { doc: 'kvkk' } })} />
          {adPrivacyOptionsAvailable && !isPro && <ListRow icon="megaphone-outline" label={t('ads.privacyOptions')} onPress={openAdPrivacyOptions} />}
          <ListRow icon="log-out-outline" label={t('profile.signOut')} onPress={handleSignOut} />
          {session && isSupabaseConfigured() && !confirmDelete && (
            <ListRow icon="trash-outline" label={t('profile.deleteAccount')} danger onPress={() => setConfirmDelete(true)} />
          )}
        </Card>
        {session && isSupabaseConfigured() && confirmDelete && (
          <Card style={{ borderColor: colors.danger }}>
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
            <Button title={t('profile.deleteConfirm')} variant="danger" loading={deleting} onPress={handleDelete} />
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setConfirmDelete(false)} />
          </Card>
        )}
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('profile.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </View>
    </Screen>
  );
}

function ListRow({ icon, label, onPress, danger = false }: { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void; danger?: boolean }) {
  const { colors } = useTheme();
  return (
    <Tap accessibilityRole="button" onPress={onPress} feedback="select" scaleTo={0.99}>
      <View style={styles.listRow}>
        <IconBadge icon={icon} size={36} color={danger ? colors.danger : colors.textSecondary} />
        <Text variant="body" color={danger ? 'danger' : 'text'} style={styles.flex}>
          {label}
        </Text>
        <DirIcon name="chevron-forward" size={16} color={colors.textMuted} />
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  identityText: { flex: 1, gap: 2 },
  avatar: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  planIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.85)' },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.lg },
  rowValue: { flex: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth * 2 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
  segmentItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: Radius.pill },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
