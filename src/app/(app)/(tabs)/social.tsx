import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const SAFETY: { icon: ComponentProps<typeof Ionicons>['name']; key: 'safetyLocation' | 'safetyPublic' | 'safetyBlock' | 'safetyWomen' }[] = [
  { icon: 'locate-outline', key: 'safetyLocation' },
  { icon: 'cafe-outline', key: 'safetyPublic' },
  { icon: 'hand-left-outline', key: 'safetyBlock' },
  { icon: 'female-outline', key: 'safetyWomen' },
];

export default function SocialScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="display">{t('social.title')}</Text>
        <Text variant="body" color="textSecondary">
          {t('social.subtitle')}
        </Text>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="subtitle">{t('social.safetyTitle')}</Text>
        {SAFETY.map((s) => (
          <View key={s.key} style={styles.row}>
            <Ionicons name={s.icon} size={22} color={colors.accent} />
            <Text variant="body" style={styles.rowText}>
              {t(`social.${s.key}`)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.cta}>
        <Button title={t('social.enable')} disabled />
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('common.stepSoon', { step: 13 })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm },
  card: { gap: Spacing.lg, padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1 },
  row: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  rowText: { flex: 1 },
  cta: { gap: Spacing.sm },
  center: { textAlign: 'center' },
});
