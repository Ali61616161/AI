import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useCurrentPlan } from '@/features/subscription/purchases';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { inviteLink, ShareError, useCreateTripInvite, useRevokeTripInvite, useTripInvites } from './api';

const ERROR_KEYS = { invalid_email: 'share.errInvalid', self: 'share.errSelf', too_many: 'share.errMany', pro_required: 'share.proOnly', unknown: 'share.errUnknown' } as const;

/** Seyahat sahibi: Pro ise arkadaşlarını e-postayla "yalnızca görüntüleyici" olarak davet eder. */
export function ShareSection({ tripId, tripTitle }: { tripId: string; tripTitle: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: plan } = useCurrentPlan();
  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly';
  const invites = useTripInvites(tripId, isPro);
  const create = useCreateTripInvite(tripId);
  const revoke = useRevokeTripInvite(tripId);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sendLink = (to: string, token: string) =>
    Share.share({ message: t('share.message', { title: tripTitle, link: inviteLink(token) }), title: t('share.title') }).catch(() => undefined);

  async function invite() {
    setError(null);
    try {
      const token = await create.mutateAsync(email.trim());
      setEmail('');
      await sendLink(email, token);
    } catch (e) {
      setError(t(ERROR_KEYS[e instanceof ShareError ? e.code : 'unknown']));
    }
  }

  return (
    <Card>
      <View style={styles.head}>
        <Ionicons name="people-outline" size={20} color={colors.primary} />
        <Text variant="subtitle">{t('share.title')}</Text>
      </View>
      <Text variant="caption" color="textSecondary">
        {isPro ? t('share.body') : t('share.proOnly')}
      </Text>
      {isPro ? (
        <>
          <TextField label={t('share.emailLabel')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" error={error} onSubmitEditing={invite} />
          <Button title={t('share.send')} disabled={!email.includes('@')} loading={create.isPending} onPress={invite} />
          <Text variant="caption" color="textMuted">
            {t('share.hint')}
          </Text>
          {(invites.data ?? []).map((i) => (
            <View key={i.id} style={styles.row}>
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {i.email}
                </Text>
                <Text variant="caption" color={i.accepted_at ? 'success' : 'textMuted'}>
                  {i.accepted_at ? t('share.accepted') : t('share.pending')}
                </Text>
              </View>
              {!i.accepted_at && (
                <Pressable accessibilityRole="button" accessibilityLabel={t('share.resend')} hitSlop={8} onPress={() => sendLink(i.email, i.token)}>
                  <Ionicons name="share-outline" size={20} color={colors.primary} />
                </Pressable>
              )}
              <Pressable accessibilityRole="button" accessibilityLabel={t('share.revoke')} hitSlop={8} onPress={() => revoke.mutate(i.id)}>
                <Ionicons name="close-circle-outline" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          ))}
        </>
      ) : (
        <UpgradeButton tripId={tripId} />
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
});
