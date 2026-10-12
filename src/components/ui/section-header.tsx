import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';
import { Text } from './text';

/** Bölüm başlığı; isteğe bağlı sağda "tümü" bağlantısı. */
export function SectionHeader({ title, overline, action, onAction }: { title: string; overline?: string; action?: string; onAction?: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        {overline && (
          <Text variant="overline" color="textMuted">
            {overline}
          </Text>
        )}
        <Text variant="heading">{title}</Text>
      </View>
      {action && onAction && (
        <Tap accessibilityRole="button" onPress={onAction} hitSlop={10} feedback="select" style={styles.action}>
          <Text variant="caption" color="primary">
            {action}
          </Text>
          <Ionicons name="arrow-forward" size={14} color={colors.primary} />
        </Tap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.md },
  texts: { flex: 1, gap: Spacing.xxs },
  action: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs, paddingBottom: 3 },
});
