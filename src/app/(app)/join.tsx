import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAcceptTripInvite, useMyTripInvites } from '@/features/sharing/api';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * yola://join?token=… bağlantısı: davet edilen seyahat gösterilir ve kullanıcı onaylarsa kabul edilir
 * (bağlantıya dokunmak tek başına kimseyi bir seyahate eklemez).
 */
export default function JoinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const invites = useMyTripInvites();
  const accept = useAcceptTripInvite();
  const invite = invites.data?.find((i) => i.token === token) ?? null;

  if (invites.isPending) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  return (
    <Screen>
      {!invite || accept.isError ? (
        <>
          <Text variant="body">{t('share.acceptFailed')}</Text>
          <Button title={t('common.close')} variant="secondary" onPress={() => router.replace('/')} />
        </>
      ) : (
        <Card variant="glow">
          <View style={styles.body}>
            <Text variant="subtitle">{t('share.inviteTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('share.inviteBody', { title: invite.trip_title })}
            </Text>
            <Button title={t('share.accept')} loading={accept.isPending} onPress={() => accept.mutate(invite.token, { onSuccess: (tripId) => router.replace(`/trip/${tripId}`) })} />
            <Button title={t('live.notNow')} variant="ghost" onPress={() => router.replace('/')} />
          </View>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ body: { gap: Spacing.sm } });
