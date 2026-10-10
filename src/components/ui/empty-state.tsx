import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  children?: ReactNode;
};

export function EmptyState({ icon, title, description, children }: Props) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name={icon} size={28} color={colors.primary} />
      </View>
      <Text variant="subtitle" style={styles.center}>
        {title}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.center}>
        {description}
      </Text>
      {children && <View style={styles.actions}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { textAlign: 'center' },
  actions: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
});
