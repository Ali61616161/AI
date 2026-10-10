import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
};

/** Onboarding adımlarının üst kısmı: ilerleme çubuğu, başlık, açıklama. */
export function StepHeader({ step, total, title, subtitle }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <View style={styles.bars} accessibilityLabel={`${step}/${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={[styles.bar, { backgroundColor: i < step ? colors.primary : colors.surfaceMuted }]}
          />
        ))}
      </View>
      <Text variant="title">{title}</Text>
      {subtitle && (
        <Text variant="body" color="textSecondary">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  bars: { flexDirection: 'row', gap: Spacing.xs, marginBottom: Spacing.sm },
  bar: { flex: 1, height: 4, borderRadius: Radius.pill },
});
