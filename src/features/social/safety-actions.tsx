import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/theme/tokens';

import { REPORT_REASONS, useBlockAndReport } from './api';

/**
 * Yakındaki gezgin ve davet satırlarında "Şikayet et / engelle": sohbet açılmadan da istenmeyen
 * kişi engellenebilir (App Store 1.2). Engellenen kişi listeden ve davetlerden kalkar.
 */
export function SafetyActions({ userId, inviteId }: { userId: string; inviteId?: string }) {
  const { t } = useTranslation();
  const safety = useBlockAndReport();
  const [open, setOpen] = useState(false);
  const block = (reason?: (typeof REPORT_REASONS)[number]) => safety.mutate({ userId, inviteId, reason }, { onSuccess: () => setOpen(false) });

  if (!open) return <Chip icon="flag-outline" label={t('social.report')} onPress={() => setOpen(true)} />;
  return (
    <View style={styles.panel}>
      <Text variant="caption" color="textSecondary">
        {t('social.reportTitle')}
      </Text>
      <View style={styles.chips}>
        {REPORT_REASONS.map((r) => (
          <Chip key={r} label={t(`social.reasons.${r}`)} onPress={() => block(r)} />
        ))}
        <Chip icon="ban-outline" label={t('social.blockOnly')} onPress={() => block()} />
        <Chip icon="close" label={t('common.cancel')} onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: Spacing.xs, marginTop: Spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
});
