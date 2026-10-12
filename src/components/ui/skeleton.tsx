import { useEffect } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Yüklenirken içerik yerine nabız gibi atan gri bloklar. */
export function Skeleton({ width = '100%', height = 16, radius = Radius.sm }: { width?: DimensionValue; height?: number; radius?: number }) {
  const { colors } = useTheme();
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 850, easing: Easing.inOut(Easing.quad) }), -1, true));
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.get() }));
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfaceStrong }, style]} />;
}

/** Kart görünümünde iskelet (liste yüklenirken). */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} accessibilityLabel="…">
      <Skeleton width="55%" height={18} />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? '70%' : '100%'} height={12} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.xl, gap: Spacing.sm, borderWidth: StyleSheet.hairlineWidth * 2 },
});
