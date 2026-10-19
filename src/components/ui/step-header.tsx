import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { useSessionStore } from '@/stores/session-store';
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
  const isGuest = useSessionStore((s) => s.isGuest);
  const signOut = useSessionStore((s) => s.signOut);
  // Önceki adım varsa ona döner; ilk adımda hesapsız devam edilmişse karşılama ekranına çıkılır.
  const canGoBack = router.canGoBack();
  const onBack = canGoBack ? () => router.back() : isGuest ? signOut : null;
  return (
    <View style={styles.wrap}>
      {onBack && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} hitSlop={12} style={[styles.back, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
      )}
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
  back: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  bars: { flexDirection: 'row', gap: Spacing.xs },
  bar: { flex: 1, height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  texts: { gap: Spacing.sm },
});
