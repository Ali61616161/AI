import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { OrbitHero } from '@/components/brand/orbit-hero';
import { Aurora } from '@/components/ui/aurora';
import { Button } from '@/components/ui/button';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { Wheel } from '@/features/spin/wheel';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Slide = { key: 'plan' | 'city' | 'spin' | 'passport'; visual: (size: number) => React.ReactNode };

function PulseRing({ size, progress, delay }: { size: number; progress: SharedValue<number>; delay: number }) {
  const style = useAnimatedStyle(() => {
    const p = (progress.get() + delay) % 1;
    return { opacity: 1 - p, transform: [{ scale: 0.4 + p * 0.9 }] };
  });
  return <Animated.View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }, style]} />;
}

/** Şehrim görseli: nabız gibi atan halkalar ve etrafında yüzen mekan simgeleri. */
function CityPulse({ size }: { size: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.set(withRepeat(withTiming(1, { duration: 2400, easing: Easing.out(Easing.quad) }), -1, false));
  }, [t]);
  const icons: { name: ComponentProps<typeof Ionicons>['name']; x: number; y: number; colors: readonly [string, string] }[] = [
    { name: 'restaurant', x: 0.12, y: 0.2, colors: Gradients.primary },
    { name: 'cafe', x: 0.74, y: 0.12, colors: Gradients.accent },
    { name: 'musical-notes', x: 0.8, y: 0.66, colors: Gradients.primary },
    { name: 'leaf', x: 0.08, y: 0.7, colors: Gradients.accent },
  ];
  return (
    <View style={{ width: size, height: size }}>
      <PulseRing size={size} progress={t} delay={0} />
      <PulseRing size={size} progress={t} delay={0.5} />
      <LinearGradient colors={Gradients.primary} style={[styles.pin, { left: size / 2 - 40, top: size / 2 - 40 }]}>
        <Ionicons name="location" size={40} color="#FFFFFF" />
      </LinearGradient>
      {icons.map((ic) => (
        <LinearGradient key={ic.name} colors={ic.colors} style={[styles.floating, { left: ic.x * size, top: ic.y * size }]}>
          <Ionicons name={ic.name} size={22} color="#FFFFFF" />
        </LinearGradient>
      ))}
    </View>
  );
}

function SpinVisual({ size }: { size: number }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.set(withRepeat(withTiming(360, { duration: 14000, easing: Easing.linear }), -1, false));
  }, [rotation]);
  return <Wheel size={size * 0.9} labels={['🇯🇵', '🇮🇹', '🇬🇪', '🇲🇽', '🇹🇭', '🇵🇹', '🇲🇦', '🇰🇷']} rotation={rotation} />;
}

/** Pasaport kartı: ülke damgaları ve "vizesiz" sayacı. */
function PassportVisual({ size }: { size: number }) {
  const { t } = useTranslation();
  const tilt = useSharedValue(0);
  useEffect(() => {
    tilt.set(withRepeat(withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) }), -1, true));
  }, [tilt]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${interpolate(tilt.get(), [0, 1], [-6, 4])}deg` }, { translateY: interpolate(tilt.get(), [0, 1], [0, -8]) }] }));
  const w = size * 0.62;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={style}>
        <LinearGradient colors={['#1D2B64', '#7C5CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.passport, { width: w, height: w * 1.38 }]}>
          <Ionicons name="globe-outline" size={w * 0.34} color="rgba(255,255,255,0.9)" />
          <Text variant="overline" style={styles.passportText}>
            {t('intro.passportCard')}
          </Text>
        </LinearGradient>
      </Animated.View>
      {[
        { f: '🇬🇪', x: 0.06, y: 0.16, r: -12 },
        { f: '🇯🇵', x: 0.72, y: 0.1, r: 10 },
        { f: '🇲🇽', x: 0.76, y: 0.7, r: -8 },
        { f: '🇷🇸', x: 0.04, y: 0.72, r: 14 },
      ].map((s) => (
        <View key={s.f} style={[styles.stamp, { left: s.x * size, top: s.y * size, transform: [{ rotate: `${s.r}deg` }] }]}>
          <Text style={styles.stampFlag}>{s.f}</Text>
          <Ionicons name="checkmark-circle" size={14} color="#2EE6C9" />
        </View>
      ))}
    </View>
  );
}

const SLIDES: Slide[] = [
  { key: 'plan', visual: (size) => <OrbitHero size={size} /> },
  { key: 'city', visual: (size) => <CityPulse size={size} /> },
  { key: 'spin', visual: (size) => <SpinVisual size={size} /> },
  { key: 'passport', visual: (size) => <PassportVisual size={size} /> },
];

function Dot({ index, scroll, width }: { index: number; scroll: SharedValue<number>; width: number }) {
  const { colors } = useTheme();
  const style = useAnimatedStyle(() => {
    const p = interpolate(scroll.get() / width, [index - 1, index, index + 1], [0, 1, 0], 'clamp');
    return { width: 8 + p * 20, opacity: 0.35 + p * 0.65 };
  });
  return <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, style]} />;
}

function SlideView({ slide, index, scroll, width }: { slide: Slide; index: number; scroll: SharedValue<number>; width: number }) {
  const { t } = useTranslation();
  const visualSize = Math.min(width - Spacing.xl * 2, 300);
  // Parallaks: görsel metinden daha yavaş kayar ve hafifçe küçülür.
  const visual = useAnimatedStyle(() => {
    const p = scroll.get() / width - index;
    return { opacity: 1 - Math.min(Math.abs(p), 1) * 0.6, transform: [{ translateX: p * width * 0.35 }, { scale: 1 - Math.min(Math.abs(p), 1) * 0.15 }] };
  });
  return (
    <View style={[styles.slide, { width }]}>
      <Animated.View style={[styles.visual, visual]}>{slide.visual(visualSize)}</Animated.View>
      <View style={styles.copy}>
        <Text variant="overline" color="primary">
          {t(`intro.${slide.key}.overline`)}
        </Text>
        <Text variant="hero">{t(`intro.${slide.key}.title`)}</Text>
        <Text variant="body" color="textSecondary">
          {t(`intro.${slide.key}.body`)}
        </Text>
      </View>
    </View>
  );
}

/** İlk açılışta gösterilen, kaydırmalı tanıtım. */
export default function IntroScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const setIntroSeen = useSessionStore((s) => s.setIntroSeen);
  const scroll = useSharedValue(0);
  const ref = useRef<Animated.ScrollView>(null);
  const [page, setPage] = useState(0);
  const last = page === SLIDES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    scroll.set(e.contentOffset.x);
  });

  function finish() {
    setIntroSeen();
    router.replace('/welcome');
  }

  function next() {
    if (last) return finish();
    ref.current?.scrollTo({ x: (page + 1) * width, animated: true });
  }

  return (
    <View style={styles.fill}>
      <Aurora />
      <SafeAreaView style={styles.fill}>
        <View style={styles.top}>
          <Tap accessibilityRole="button" onPress={finish} hitSlop={12} feedback="select">
            <Text variant="bodyStrong" color="textSecondary">
              {t('intro.skip')}
            </Text>
          </Tap>
        </View>
        <Animated.ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {SLIDES.map((s, i) => (
            <SlideView key={s.key} slide={s} index={i} scroll={scroll} width={width} />
          ))}
        </Animated.ScrollView>
        <View style={styles.footer}>
          <View style={styles.dots} accessibilityLabel={t('intro.page', { page: page + 1, total: SLIDES.length })}>
            {SLIDES.map((s, i) => (
              <Dot key={s.key} index={i} scroll={scroll} width={width} />
            ))}
          </View>
          <Button title={last ? t('intro.start') : t('intro.next')} icon="arrow-forward" onPress={next} />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm },
  slide: { flex: 1, paddingHorizontal: Spacing.xl, justifyContent: 'center', gap: Spacing.xl, maxWidth: 640, alignSelf: 'center' },
  visual: { alignItems: 'center', justifyContent: 'center' },
  copy: { gap: Spacing.sm },
  footer: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  dots: { flexDirection: 'row', gap: 6, alignSelf: 'center' },
  dot: { height: 8, borderRadius: 4 },
  ring: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,122,69,0.45)' },
  pin: { position: 'absolute', width: 80, height: 80, borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF3D7F', shadowOpacity: 0.6, shadowRadius: 24 },
  floating: { position: 'absolute', width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  passport: { borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', shadowColor: '#7C5CFF', shadowOpacity: 0.6, shadowRadius: 30 },
  passportText: { color: 'rgba(255,255,255,0.9)', letterSpacing: 3 },
  stamp: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: 'rgba(11,16,32,0.75)', borderWidth: 1, borderColor: 'rgba(46,230,201,0.5)' },
  stampFlag: { fontSize: 18 },
});
