import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown, cancelAnimation, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Aurora } from '@/components/ui/aurora';
import { Text } from '@/components/ui/text';
import { asBuildError, progressFraction, remainingHoldMs, stepIndex } from '@/features/trips/building-logic';
import { GenerateError, useGenerateItinerary, useTrip } from '@/features/trips/queries';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const STEPS = ['building.step1', 'building.step2', 'building.step3', 'building.step4', 'building.step5'] as const;

/**
 * Yeni seyahat kurulunca tam ekran "oluşturuluyor" sayfası: rota arka planda üretilir, en az 5 saniye gösterilir
 * ve hazır olunca seyahat doğrudan açılır. Hata olursa beklemeden seyahat açılır ve rota kartı yeniden dener.
 */
export default function TripBuildingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const generate = useGenerateItinerary(tripId);
  const started = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    spin.value = withRepeat(withTiming(1, { duration: 6000, easing: Easing.linear }), -1, false);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 1400, easing: Easing.inOut(Easing.quad) })), -1, false);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [reduceMotion, spin, pulse]);

  useEffect(() => {
    if (started.current !== null) return;
    const startedAt = Date.now();
    started.current = startedAt;
    const timer = setInterval(() => setElapsed(Date.now() - startedAt), 250);
    (async () => {
      let failed: string | null = null;
      try {
        await generate.mutateAsync(undefined);
      } catch (e) {
        failed = e instanceof GenerateError ? e.code : 'network';
      }
      const hold = remainingHoldMs(startedAt, Date.now(), failed !== null);
      if (hold > 0) await new Promise((resolve) => setTimeout(resolve, hold));
      clearInterval(timer);
      router.replace({ pathname: '/trip/[id]', params: { id: tripId, ...(asBuildError(failed) ? { genError: failed! } : {}) } });
    })();
    return () => clearInterval(timer);
    // Bir kez çalışır: üretim yeniden başlatılmamalı.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value * 360}deg` }] }));
  const glow = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.45, transform: [{ scale: 1 + pulse.value * 0.12 }] }));
  const step = stepIndex(elapsed, STEPS.length);

  return (
    <View style={styles.root}>
      <Aurora />
      <View style={styles.center}>
        <View style={styles.orb}>
          <Animated.View style={[styles.glow, { backgroundColor: colors.primary }, glow]} />
          <Animated.View style={[styles.ring, { borderColor: colors.primary }, ring]}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          </Animated.View>
          <Ionicons name="airplane" size={44} color={colors.text} />
        </View>
        <Text variant="display" style={styles.text}>
          {t('building.title')}
        </Text>
        {trip?.title ? (
          <Text variant="subtitle" color="textSecondary" style={styles.text}>
            {trip.title}
          </Text>
        ) : null}
        <View style={styles.steps} accessibilityLiveRegion="polite">
          {STEPS.map((key, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <Animated.View key={key} entering={reduceMotion ? undefined : FadeInDown.duration(280)} style={[styles.stepRow, { opacity: done ? 0.55 : current ? 1 : 0.25 }]}>
                <Ionicons name={done ? 'checkmark-circle' : current ? 'ellipse' : 'ellipse-outline'} size={done ? 18 : 12} color={done || current ? colors.primary : colors.textMuted} style={styles.stepIcon} />
                <Text variant="body" color={current ? 'primary' : 'textSecondary'} numberOfLines={2} style={styles.flex}>
                  {t(key)}
                </Text>
              </Animated.View>
            );
          })}
        </View>
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="progressbar">
          <View style={[styles.fill, { backgroundColor: colors.primary, width: `${Math.round(progressFraction(elapsed) * 100)}%` }]} />
        </View>
        <Text variant="caption" color="textMuted" style={styles.text}>
          {t('building.hint')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.lg, paddingHorizontal: Spacing.xl },
  orb: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  glow: { position: 'absolute', width: 140, height: 140, borderRadius: 70 },
  ring: { position: 'absolute', width: 160, height: 160, borderRadius: 80, borderWidth: 2, borderStyle: 'dashed', alignItems: 'flex-start', justifyContent: 'flex-start' },
  dot: { width: 14, height: 14, borderRadius: 7, marginLeft: 73, marginTop: -7 },
  text: { textAlign: 'center' },
  flex: { flex: 1 },
  steps: { alignSelf: 'stretch', gap: Spacing.sm, marginTop: Spacing.sm },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepIcon: { width: 20, textAlign: 'center' },
  track: { alignSelf: 'stretch', height: 6, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.sm },
  fill: { height: 6, borderRadius: Radius.pill },
});
