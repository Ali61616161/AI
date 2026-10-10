import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  /** Seçiliyken kullanılacak vurgu rengi (ör. bütçe türü renkleri). */
  accent?: string;
  multiple?: boolean;
};

/** Onboarding'de "kiminle", "bütçe" gibi seçimler için büyük, dokunulabilir kart. */
export function OptionCard({ icon, title, description, selected, onPress, accent, multiple = false }: Props) {
  const { colors } = useTheme();
  const tint = accent ?? colors.primary;

  return (
    <Pressable
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: selected ? tint : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: selected ? tint : colors.surfaceMuted }]}>
        <Ionicons name={icon} size={24} color={selected ? colors.onPrimary : colors.text} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodyStrong">{title}</Text>
        {description && (
          <Text variant="caption" color="textSecondary">
            {description}
          </Text>
        )}
      </View>
      <Ionicons
        name={selected ? 'checkmark-circle' : 'ellipse-outline'}
        size={22}
        color={selected ? tint : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: Spacing.xxs },
});
