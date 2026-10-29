import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useEffect, useState, type ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { useTrips } from '@/features/trips/queries';
import { pickWidgetTrip } from '@/features/widget/build-widget-timeline';
import { todayIsoDate } from '@/lib/format';
import { Text } from '@/components/ui/text';
import { Gradients, Motion, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const ICONS: Record<string, { active: IconName; inactive: IconName }> = {
  index: { active: 'planet', inactive: 'planet-outline' },
  trips: { active: 'airplane', inactive: 'airplane-outline' },
  explore: { active: 'map', inactive: 'map-outline' },
  social: { active: 'people', inactive: 'people-outline' },
  profile: { active: 'person-circle', inactive: 'person-circle-outline' },
};

const ORB = 58;

/**
 * Yüzen cam alt menü. Seçili sekmenin arkasında yayla kayan bir ışık vardır; ortadaki
 * parlayan düğme "Canlı": sürmekte olan seyahatin günü yöneten ekranını açar (seyahat yaklaşıyorsa seyahat
 * ekranını, hiç seyahat yoksa Seyahatler sekmesini).
 */
export function TabBar({ state, descriptors, navigation, insets }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();
  const { t } = useTranslation();
  const middle = Math.ceil(state.routes.length / 2);
  const [tabWidth, setTabWidth] = useState(0);
  const { data: trips } = useTrips();
  const slot = state.index < middle ? state.index : state.index + 1; // ortadaki düğme bir yuva kaplar
  const x = useSharedValue(0);
  const glow = useSharedValue(0.4);

  useEffect(() => {
    x.set(withSpring(slot * tabWidth, Motion.enter));
  }, [slot, tabWidth, x]);
  useEffect(() => {
    glow.set(withRepeat(withSequence(withTiming(0.75, { duration: 1600 }), withTiming(0.4, { duration: 1600 })), -1));
  }, [glow]);

  const openLive = () => {
    const trip = pickWidgetTrip(trips);
    if (!trip) {
      navigation.navigate('trips');
      return;
    }
    if (trip.start_date && trip.start_date <= todayIsoDate()) router.push({ pathname: '/trip-live', params: { tripId: trip.id } });
    else router.push({ pathname: '/trip/[id]', params: { id: trip.id } });
  };

  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const orbGlow = useAnimatedStyle(() => ({ shadowOpacity: glow.get() }));

  const tabs = state.routes.map((route, index) => {
    const focused = state.index === index;
    const { options } = descriptors[route.key];
    const icon = ICONS[route.name] ?? { active: 'ellipse', inactive: 'ellipse-outline' };
    const color = focused ? colors.text : colors.textMuted;

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };

    return (
      <Tap
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={options.title}
        onPress={onPress}
        feedback="select"
        scaleTo={0.9}
        style={styles.tab}>
        <Ionicons name={focused ? icon.active : icon.inactive} size={22} color={focused ? colors.primary : color} />
        <Text variant="caption" numberOfLines={1} style={[styles.label, { color }]}>
          {options.title}
        </Text>
      </Tap>
    );
  });

  const glass =
    Platform.OS === 'ios' ? (
      <BlurView tint={isDark ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} intensity={80} style={StyleSheet.absoluteFill} />
    ) : (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? 'rgba(12,18,34,0.92)' : 'rgba(255,255,255,0.94)' }]} />
    );

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: Math.max(insets.bottom - 6, Spacing.md) }]}>
      <View style={[styles.bar, { borderColor: colors.borderStrong, shadowColor: '#000' }]} onLayout={(e) => setTabWidth((e.nativeEvent.layout.width - Spacing.xs * 2) / (state.routes.length + 1))}>
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
          {glass}
        </View>
        {tabWidth > 0 && (
          <Animated.View style={[styles.indicator, { width: tabWidth }, indicator]}>
            <View style={[styles.indicatorPill, { backgroundColor: colors.surfaceStrong }]} />
          </Animated.View>
        )}
        <View style={styles.row}>
          {tabs.slice(0, middle)}
          <View style={styles.tab}>
            <Animated.View style={[styles.orbShadow, orbGlow]}>
              <Tap accessibilityRole="button" accessibilityLabel={t('tabs.live')} onPress={openLive} feedback="press" scaleTo={0.9}>
                <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.orb}>
                  <View pointerEvents="none" style={styles.orbShine} />
                  <Ionicons name="navigate" size={24} color="#FFFFFF" />
                </LinearGradient>
              </Tap>
            </Animated.View>
          </View>
          {tabs.slice(middle)}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg },
  bar: {
    borderRadius: Radius.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'visible',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
    paddingHorizontal: Spacing.xs,
  },
  clip: { borderRadius: Radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', height: 66 },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, height: '100%' },
  label: { fontSize: 10.5, lineHeight: 13 },
  indicator: { position: 'absolute', top: 7, bottom: 7, left: Spacing.xs, alignItems: 'center' },
  indicatorPill: { flex: 1, width: '88%', borderRadius: Radius.lg },
  orbShadow: { shadowColor: '#FF4D6A', shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 10, borderRadius: ORB / 2, marginTop: -26 },
  orb: { width: ORB, height: ORB, borderRadius: ORB / 2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 3, borderColor: 'rgba(255,255,255,0.18)' },
  orbShine: { position: 'absolute', top: 0, left: 0, right: 0, height: ORB / 2, backgroundColor: 'rgba(255,255,255,0.16)' },
});
