import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** 1–5 yıldız puanlama. */
export function Stars({ value, onChange, size = 28, label }: { value: number | null; onChange?: (v: number) => void; size?: number; label: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.row} accessibilityRole="adjustable" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 5, now: value ?? 0 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          accessibilityRole="button"
          accessibilityLabel={t('report.starsLabel', { count: n })}
          disabled={!onChange}
          hitSlop={4}
          onPress={() => onChange?.(n)}>
          <Ionicons name={value !== null && n <= value ? 'star' : 'star-outline'} size={size} color={value !== null && n <= value ? colors.warning : colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', gap: Spacing.xs } });
