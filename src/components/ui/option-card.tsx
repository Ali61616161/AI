import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';
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
  const { colors, isDark } = useTheme();
  const tint = accent ?? colors.primary;

  return (
    <Tap
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={multiple ? { checked: selected } : { selected }}
      onPress={onPress}
      feedback="select"
      scaleTo={0.98}
      style={[
        styles.card,
        {
          backgroundColor: selected ? `${tint}1F` : colors.surface,
          borderColor: selected ? tint : colors.border,
          shadowColor: tint,
          shadowOpacity: selected && isDark ? 0.35 : 0,
        },
      ]}>
      {selected ? (
        <LinearGradient colors={[tint, `${tint}99`]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.icon}>
          <Ionicons name={icon} size={24} color="#FFFFFF" />
        </LinearGradient>
      ) : (
        <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={icon} size={24} color={colors.textSecondary} />
        </View>
      )}
      <View style={styles.texts}>
        <Text variant="bodyStrong">{title}</Text>
        {description && (
          <Text variant="caption" color="textSecondary">
            {description}
          </Text>
        )}
      </View>
      <View style={[styles.check, { borderColor: selected ? tint : colors.borderStrong, backgroundColor: selected ? tint : 'transparent' }]}>
        {selected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
  },
  icon: { width: 50, height: 50, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: Spacing.xxs },
  check: { width: 24, height: 24, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
});
