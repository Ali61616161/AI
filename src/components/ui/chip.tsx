import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';
import { Text } from './text';

type Props = {
  label: string;
  icon?: ComponentProps<typeof Ionicons>['name'];
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, icon, selected = false, onPress }: Props) {
  const { colors } = useTheme();
  const foreground = selected ? colors.onPrimary : colors.text;
  const inner = (
    <>
      {icon && <Ionicons name={icon} size={15} color={selected ? foreground : colors.textSecondary} />}
      <Text variant="caption" numberOfLines={1} style={{ color: foreground }}>
        {label}
      </Text>
    </>
  );

  const body = selected ? (
    <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.chip, styles.selected]}>
      {inner}
    </LinearGradient>
  ) : (
    <View style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>{inner}</View>
  );

  if (!onPress) return <View accessibilityRole="text">{body}</View>;
  return (
    <Tap accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={onPress} feedback="select" scaleTo={0.94}>
      {body}
    </Tap>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: 9,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  selected: { borderColor: 'transparent' },
});
