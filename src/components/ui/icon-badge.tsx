import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Gradients, Radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  size?: number;
  /** gradient: dolu geçişli kare; soft: cam zemin üzerinde renkli ikon. */
  tone?: 'gradient' | 'soft' | 'accent';
  color?: string;
};

/** Yuvarlatılmış kare içinde ikon; listelerde ve kartlarda tutarlı görünüm için. */
export function IconBadge({ icon, size = 44, tone = 'soft', color }: Props) {
  const { colors } = useTheme();
  const iconSize = Math.round(size * 0.48);
  if (tone === 'soft') {
    return (
      <View style={[styles.box, { width: size, height: size, borderRadius: size * 0.34, backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <Ionicons name={icon} size={iconSize} color={color ?? colors.primary} />
      </View>
    );
  }
  return (
    <LinearGradient
      colors={tone === 'accent' ? Gradients.accent : Gradients.primary}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.box, { width: size, height: size, borderRadius: size * 0.34 }]}>
      <Ionicons name={icon} size={iconSize} color="#FFFFFF" />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, borderColor: 'transparent', borderRadius: Radius.md },
});
