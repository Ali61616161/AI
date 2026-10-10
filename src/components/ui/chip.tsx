import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

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

  return (
    <Pressable
      accessibilityRole={onPress ? 'checkbox' : 'text'}
      accessibilityState={onPress ? { checked: selected } : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}>
      {icon && <Ionicons name={icon} size={16} color={foreground} />}
      <Text variant="caption" style={{ color: foreground }}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
