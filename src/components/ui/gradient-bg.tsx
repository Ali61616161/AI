import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { Gradients } from '@/theme/tokens';

/** Bulunduğu kutunun arkasını geçişle doldurur (kutuda overflow: 'hidden' olmalı). */
export function GradientBg({ colors = Gradients.primary }: { colors?: readonly [string, string, ...string[]] }) {
  return <LinearGradient pointerEvents="none" colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />;
}
