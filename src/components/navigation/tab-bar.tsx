import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'sunny', inactive: 'sunny-outline' },
  trips: { active: 'airplane', inactive: 'airplane-outline' },
  social: { active: 'people', inactive: 'people-outline' },
  profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

/**
 * Alt menü: dört sekme ve ortada her ekrandan "Planı Değiştir" asistanını açan buton.
 * Buton ilk iki sekmeden sonra yerleşir.
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const middle = Math.ceil(state.routes.length / 2);

  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const icon = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
    const color = focused ? colors.primary : colors.textMuted;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.title}
        onPress={onPress}
        style={styles.tab}>
        <Ionicons name={focused ? icon.active : icon.inactive} size={24} color={color} />
        <Text variant="caption" numberOfLines={1} style={[styles.label, { color }]}>
          {options.title}
        </Text>
      </Pressable>
    );
  });

  return (
    <View
      style={[
        styles.bar,
        { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: Math.max(insets.bottom, Spacing.sm) },
      ]}>
      {tabs.slice(0, middle)}
      <View style={styles.fabSlot}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('assistant.openAssistant')}
          onPress={() => router.push('/assistant')}
          style={({ pressed }) => [
            styles.fab,
            { backgroundColor: colors.primary, shadowColor: colors.primary, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}>
          <Ionicons name="sparkles" size={26} color={colors.onPrimary} />
        </Pressable>
      </View>
      {tabs.slice(middle)}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  tab: { flex: 1, alignItems: 'center', gap: Spacing.xxs, paddingVertical: Spacing.xs },
  label: { fontSize: 11, lineHeight: 14 },
  fabSlot: { width: 72, alignItems: 'center' },
  fab: {
    width: 60,
    height: 60,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -28,
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
