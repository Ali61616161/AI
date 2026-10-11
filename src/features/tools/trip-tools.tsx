import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Tool = { key: 'expenses' | 'packing' | 'visa' | 'jetlag' | 'translate' | 'sos'; icon: ComponentProps<typeof Ionicons>['name']; href: Href };

/** Seyahat detayında araçlar: harcama, bavul, vize, jet lag, çeviri, acil durum. */
export function TripTools({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tools: Tool[] = [
    { key: 'expenses', icon: 'wallet-outline', href: { pathname: '/expenses', params: { tripId } } },
    { key: 'packing', icon: 'briefcase-outline', href: { pathname: '/packing', params: { tripId } } },
    { key: 'visa', icon: 'document-text-outline', href: { pathname: '/visa', params: { tripId } } },
    { key: 'jetlag', icon: 'time-outline', href: { pathname: '/jetlag', params: { tripId } } },
    { key: 'translate', icon: 'language-outline', href: '/translate' },
    { key: 'sos', icon: 'medkit-outline', href: '/sos' },
  ];
  return (
    <View style={styles.section}>
      <Text variant="subtitle">{t('tools.title')}</Text>
      <View style={styles.grid}>
        {tools.map((tool) => (
          <Pressable
            key={tool.key}
            accessibilityRole="button"
            onPress={() => router.push(tool.href)}
            style={({ pressed }) => [styles.tile, { backgroundColor: colors.surface, borderColor: tool.key === 'sos' ? colors.danger : colors.border, opacity: pressed ? 0.85 : 1 }]}>
            <Ionicons name={tool.icon} size={22} color={tool.key === 'sos' ? colors.danger : colors.primary} />
            <Text variant="caption" style={styles.center} numberOfLines={2}>
              {t(`tools.${tool.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { flexBasis: '31%', flexGrow: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs, borderRadius: Radius.lg, borderWidth: 1 },
  center: { textAlign: 'center' },
});
