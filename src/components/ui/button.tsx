import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useFlipStyle } from '@/lib/rtl';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';
import { Text } from './text';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  icon?: ComponentProps<typeof Ionicons>['name'];
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ title, variant = 'primary', size = 'md', icon, loading = false, disabled, style, ...rest }: Props) {
  const { colors } = useTheme();
  const flip = useFlipStyle();
  const filled = variant === 'primary' || variant === 'danger';
  const foreground = filled ? colors.onPrimary : variant === 'ghost' ? colors.text : colors.text;
  const height = size === 'sm' ? 42 : 54;

  const content = loading ? (
    <ActivityIndicator color={foreground} />
  ) : (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={size === 'sm' ? 16 : 18} color={foreground} style={icon.includes('forward') ? flip : undefined} />}
      <Text variant={size === 'sm' ? 'caption' : 'bodyStrong'} numberOfLines={1} style={{ color: foreground }}>
        {title}
      </Text>
    </View>
  );

  return (
    <Tap
      accessibilityRole="button"
      accessibilityState={{ disabled: !!(disabled || loading), busy: loading }}
      disabled={disabled || loading}
      feedback={variant === 'ghost' ? 'select' : 'tap'}
      style={[styles.radius, filled && !disabled && { shadowColor: variant === 'danger' ? colors.danger : '#FF4D6A', ...styles.glow }, style]}
      {...rest}>
      {filled ? (
        <LinearGradient colors={variant === 'danger' ? Gradients.danger : Gradients.primary} start={{ x: 0, y: 0.2 }} end={{ x: 1, y: 0.8 }} style={[styles.base, { minHeight: height }]}>
          <View pointerEvents="none" style={styles.shine} />
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.base,
            { minHeight: height },
            variant === 'secondary' && { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 },
          ]}>
          {content}
        </View>
      )}
    </Tap>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: Spacing.xl,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  radius: { borderRadius: Radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  shine: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: 'rgba(255,255,255,0.12)' },
  glow: { shadowOpacity: 0.45, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
