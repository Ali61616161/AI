import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/theme/tokens';

import { useAcceptTripInvite, useMyTripInvites } from './api';

/** Aynı e-postaya gelmiş seyahat davetleri; kabul edince seyahat yalnızca görüntüleme olarak açılır. */
export function PendingTripInvites() {
  const { t } = useTranslation();
  const { data } = useMyTripInvites();
  const accept = useAcceptTripInvite();
  if (!data?.length) return null;
  return (
    <>
      {data.map((invite) => (
        <Card key={invite.token} variant="glow">
          <View style={styles.body}>
            <Text variant="subtitle">{t('share.inviteTitle')}</Text>
            <Text variant="body" color="textSecondary">
              {t('share.inviteBody', { title: invite.trip_title })}
            </Text>
            {accept.isError && (
              <Text variant="caption" color="danger">
                {t('share.acceptFailed')}
              </Text>
            )}
            <Button
              title={t('share.accept')}
              loading={accept.isPending && accept.variables === invite.token}
              onPress={() => accept.mutate(invite.token, { onSuccess: (tripId) => router.push(`/trip/${tripId}`) })}
            />
          </View>
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({ body: { gap: Spacing.sm } });
