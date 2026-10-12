import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';

type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** glass: yarı saydam cam; glow: geçişli kenar ışığı; solid: dolu yüzey; gradient: geçişli dolgu. */
  variant?: 'glass' | 'glow' | 'solid' | 'gradient';
  gradient?: readonly [string, string, ...string[]];
  padding?: number;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/** Uygulamanın temel yüzeyi: üst kenarında ince ışık çizgisi olan cam kart. */
export function Card({ children, style, variant = 'glass', gradient, padding = Spacing.lg, onPress, accessibilityLabel }: Props) {
  const { colors, isDark } = useTheme();
  const fill = gradient ?? Gradients.primary;

  const body =
    variant === 'gradient' ? (
      <LinearGradient colors={fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, { padding }, style]}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.sheen]} />
        {children}
      </LinearGradient>
    ) : variant === 'glow' ? (
      <LinearGradient colors={[`${fill[0]}AA`, `${fill[fill.length - 1]}55`, colors.border]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.glowFrame, style]}>
        <View style={[styles.glowInner, { padding, backgroundColor: isDark ? colors.backgroundElevated : colors.surface }]}>{children}</View>
      </LinearGradient>
    ) : (
      <View
        style={[
          styles.card,
          {
            padding,
            backgroundColor: variant === 'solid' ? colors.backgroundElevated : colors.surface,
            borderColor: colors.border,
            borderWidth: StyleSheet.hairlineWidth * 2,
          },
          !isDark && styles.lightShadow,
          style,
        ]}>
        {isDark && <LinearGradient pointerEvents="none" colors={['rgba(255,255,255,0.09)', 'rgba(255,255,255,0)']} style={styles.edge} />}
        {children}
      </View>
    );

  if (!onPress) return body;
  return (
    <Tap accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} scaleTo={0.985}>
      {body}
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, overflow: 'hidden', gap: Spacing.md },
  edge: { position: 'absolute', top: 0, left: 0, right: 0, height: 56 },
  sheen: { backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: Radius.xl },
  glowFrame: { borderRadius: Radius.xl, padding: 1.2 },
  glowInner: { borderRadius: Radius.xl - 1, gap: Spacing.md, overflow: 'hidden' },
  lightShadow: { shadowColor: '#1A2140', shadowOpacity: 0.07, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 2 },
});
