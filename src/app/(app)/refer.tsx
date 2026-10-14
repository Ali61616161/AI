import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { APP_STORE_URL, isReferralCode, useRedeemReferral, useReferral } from '@/features/engagement/referral';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Arkadaşını davet et: kodunu paylaş, arkadaşın girince ikiniz de 7 gün Pro. */
export default function ReferScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const { data, isLoading } = useReferral();
  const redeem = useRedeemReferral();
  const [friendCode, setFriendCode] = useState('');
  const [copied, setCopied] = useState(false);

  if (!signedIn) {
    return (
      <Screen>
        <ModalHeader title={t('referral.title')} subtitle={t('referral.subtitle')} />
        <Card>
          <Text variant="body">{t('referral.needAccount')}</Text>
          <Button title={t('profile.createAccount')} variant="secondary" onPress={() => router.push('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  const share = () => {
    if (!data) return;
    Share.share({ message: t('referral.shareMessage', { code: data.code, url: APP_STORE_URL }) }).catch(() => undefined);
  };
  const copy = async () => {
    if (!data) return;
    await Clipboard.setStringAsync(data.code).catch(() => undefined);
    setCopied(true);
  };
  const result = redeem.data;

  return (
    <Screen>
      <ModalHeader title={t('referral.title')} subtitle={t('referral.subtitle')} />

      <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="gift" size={28} color="#FFFFFF" />
        <Text variant="subtitle" style={styles.white}>
          {t('referral.heroTitle')}
        </Text>
        <Text variant="body" style={styles.soft}>
          {t('referral.heroBody')}
        </Text>
        {isLoading || !data ? (
          <SkeletonCard lines={1} />
        ) : (
          <Tap accessibilityRole="button" accessibilityLabel={t('referral.copy')} onPress={copy} feedback="select" style={styles.codeBox}>
            <Text variant="hero" style={[styles.white, styles.code]}>
              {data.code}
            </Text>
            <Text variant="caption" style={styles.soft}>
              {copied ? t('referral.copied') : t('referral.copy')}
            </Text>
          </Tap>
        )}
        <Button title={t('referral.share')} icon="share-social" variant="secondary" onPress={share} disabled={!data} />
        {data && data.count > 0 && (
          <Text variant="caption" style={styles.soft}>
            {t('referral.count', { count: data.count })}
          </Text>
        )}
      </LinearGradient>

      <Card>
        <Text variant="subtitle">{t('referral.haveCode')}</Text>
        <Text variant="body" color="textSecondary">
          {t('referral.haveCodeHint')}
        </Text>
        <TextField
          label={t('referral.codeLabel')}
          value={friendCode}
          onChangeText={(v) => setFriendCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
        />
        <Button
          title={t('referral.redeem')}
          icon="sparkles"
          disabled={!isReferralCode(friendCode) || result?.ok === true}
          loading={redeem.isPending}
          onPress={() => redeem.mutate(friendCode)}
        />
        {result && (
          <View style={[styles.result, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name={result.ok ? 'checkmark-circle' : 'alert-circle'} size={18} color={result.ok ? colors.success : colors.danger} />
            <Text variant="caption" color={result.ok ? 'success' : 'danger'} style={styles.flex}>
              {result.ok ? t('referral.redeemed', { days: result.days }) : t(`referral.errors.${result.reason}`)}
            </Text>
          </View>
        )}
      </Card>

      <Text variant="caption" color="textMuted">
        {t('referral.terms')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.88)' },
  codeBox: { alignItems: 'center', gap: 4, paddingVertical: Spacing.md, borderRadius: Radius.lg, backgroundColor: 'rgba(255,255,255,0.14)' },
  code: { letterSpacing: 6 },
  result: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.sm, borderRadius: Radius.md },
});
