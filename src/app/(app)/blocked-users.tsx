import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useBlockedUsers, useUnblock } from '@/features/social/api';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Engellediğin kişiler ve engeli kaldırma. Engellenen kişi seni göremez, davet ve mesaj gönderemez. */
export default function BlockedUsersScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data, isLoading } = useBlockedUsers();
  const unblock = useUnblock();

  return (
    <Screen>
      <ModalHeader title={t('social.blockedUsers')} subtitle={t('social.blockedSubtitle')} />
      {isLoading ? (
        <ActivityIndicator />
      ) : !data?.length ? (
        <EmptyState icon="ban-outline" title={t('social.blockedUsers')} description={t('social.blockedEmpty')} />
      ) : (
        data.map((u) => (
          <View key={u.blocked_id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
              <Text variant="bodyStrong">{(u.display_name ?? '?')[0]?.toUpperCase()}</Text>
            </View>
            <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
              {u.display_name ?? t('social.traveler')}
            </Text>
            <Button title={t('social.unblock')} variant="secondary" loading={unblock.isPending && unblock.variables === u.blocked_id} onPress={() => unblock.mutate(u.blocked_id)} />
          </View>
        ))
      )}
      {data?.length ? (
        <Text variant="caption" color="textMuted">
          {t('social.unblockNote')}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
