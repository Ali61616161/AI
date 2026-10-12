import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Spacing } from '@/theme/tokens';

import { Card } from './card';
import { IconBadge } from './icon-badge';
import { Text } from './text';

type Props = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  description: string;
  children?: ReactNode;
};

/** Boş durum: geçişli ikon, başlık ve açıklama solda; eylemler altta. */
export function EmptyState({ icon, title, description, children }: Props) {
  return (
    <Card variant="glow" padding={Spacing.xl}>
      <View style={styles.head}>
        <IconBadge icon={icon} tone="gradient" size={52} />
        <View style={styles.texts}>
          <Text variant="subtitle">{title}</Text>
          <Text variant="body" color="textSecondary">
            {description}
          </Text>
        </View>
      </View>
      {children && <View style={styles.actions}>{children}</View>}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { gap: Spacing.lg },
  texts: { gap: Spacing.xs },
  actions: { gap: Spacing.sm, marginTop: Spacing.xs },
});
