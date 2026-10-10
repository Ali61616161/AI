import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

export function ModalHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <Text variant="title" style={styles.title}>
          {title}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          onPress={() => router.back()}
          hitSlop={12}
          style={[styles.close, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="close" size={20} color={colors.text} />
        </Pressable>
      </View>
      {subtitle && (
        <Text variant="body" color="textSecondary">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  title: { flex: 1 },
  close: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
