import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Props = {
  step: number;
  total: number;
  title: string;
  subtitle?: string;
};

/** Onboarding adımlarının üst kısmı: geçişli ilerleme çubuğu, adım sayısı, başlık. */
export function StepHeader({ step, total, title, subtitle }: Props) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.bars} accessibilityLabel={`${step}/${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
            {i < step && <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />}
          </View>
        ))}
      </View>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.texts}>
        <Text variant="overline" color="primary">
          {t('common.stepOf', { step, total })}
        </Text>
        <Text variant="display">{title}</Text>
        {subtitle && (
          <Text variant="body" color="textSecondary">
            {subtitle}
          </Text>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  bars: { flexDirection: 'row', gap: Spacing.xs },
  bar: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  texts: { gap: Spacing.sm },
});
