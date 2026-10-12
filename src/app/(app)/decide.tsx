import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { categoryFor, pickPlace, type DecideGroup } from '@/features/decide/pick';
import { openInMaps, openNowQuery, PlacesError, type Place } from '@/features/places/api';
import { PlaceMeta } from '@/features/places/place-row';
import { useDeviceLocation } from '@/features/places/use-device-location';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { haptic } from '@/lib/haptics';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { RewardedButton } from '@/features/ads/rewarded-button';

type IconName = ComponentProps<typeof Ionicons>['name'];

const GROUPS: { key: DecideGroup; icon: IconName }[] = [
  { key: 'food', icon: 'restaurant' },
  { key: 'coffee', icon: 'cafe' },
  { key: 'sweet', icon: 'ice-cream' },
  { key: 'drinks', icon: 'wine' },
  { key: 'see', icon: 'camera' },
  { key: 'surprise', icon: 'sparkles' },
];

const RADIUS = { walk: 1000, ride: 3000 } as const;
type Phase = 'idle' | 'spinning' | 'result' | 'empty';

export default function DecideScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const location = useDeviceLocation();
  const [group, setGroup] = useState<DecideGroup>('food');
  const [distance, setDistance] = useState<keyof typeof RADIUS>('walk');
  const [topRated, setTopRated] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [reel, setReel] = useState<string>('');
  const [picked, setPicked] = useState<{ place: Place; pool: number } | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const seen = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function spin(again = false) {
    if (!again) seen.current = new Set();
    setErrorCode(null);
    const coords = location.coords ?? (await location.request());
    if (!coords) return;
    setPhase('spinning');
    haptic.press();
    try {
      const category = categoryFor(group);
      const places = await queryClient.fetchQuery(openNowQuery(category, coords, { radius: RADIUS[distance], limit: 20 }));
      const minRating = topRated ? 4.2 : null;
      const choice = pickPlace(places, { exclude: seen.current, minRating });
      if (!choice) {
        setPhase('empty');
        haptic.warning();
        return;
      }
      seen.current.add(choice.id);
      // Slot makinesi: isimler hızla döner, yavaşlar ve seçilen yerde durur.
      const names = places.map((p) => p.name);
      const steps = 14;
      let delay = 0;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      for (let i = 0; i < steps; i++) {
        delay += 45 + i * i * 2.2;
        timers.current.push(
          setTimeout(() => {
            setReel(names[(i * 7 + 3) % names.length]);
            haptic.select();
          }, delay),
        );
      }
      timers.current.push(
        setTimeout(() => {
          setPicked({ place: choice, pool: places.length });
          setPhase('result');
          haptic.success();
        }, delay + 160),
      );
    } catch (e) {
      setPhase('idle');
      setErrorCode(e instanceof PlacesError ? e.code : 'network');
    }
  }

  const needsLocation = location.status === 'needs_permission' || location.status === 'denied';

  return (
    <Screen
      footer={
        phase === 'result' && picked ? (
          <Animated.View entering={FadeInUp.delay(150)} style={styles.footer}>
            <Button title={t('decide.go')} icon="navigate" onPress={() => openInMaps({ name: picked.place.name, mapsUrl: picked.place.mapsUrl, placeId: picked.place.id, lat: picked.place.lat, lng: picked.place.lng })} />
            <View style={styles.row}>
              <Button title={t('decide.again')} icon="shuffle" variant="secondary" style={styles.flex} onPress={() => spin(true)} />
              <Button title={t('decide.change')} variant="ghost" style={styles.flex} onPress={() => setPhase('idle')} />
            </View>
          </Animated.View>
        ) : phase === 'spinning' ? null : (
          <Button title={t('decide.spin')} icon="dice" loading={location.status === 'locating'} onPress={() => spin(phase === 'empty')} />
        )
      }>
      <ModalHeader title={t('decide.title')} subtitle={phase === 'idle' || phase === 'empty' ? t('decide.subtitle') : undefined} />

      {phase === 'spinning' && (
        <Animated.View entering={FadeIn} style={styles.reelWrap}>
          <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.reel}>
            <View pointerEvents="none" style={styles.reelRing} />
            <Ionicons name="dice" size={34} color="#FFFFFF" />
            <Text variant="overline" style={styles.whiteSoft}>
              {t('decide.spinning')}
            </Text>
            <Animated.View key={reel} entering={FadeInDown.duration(120)}>
              <Text variant="title" numberOfLines={2} style={[styles.white, styles.center]}>
                {reel || '· · ·'}
              </Text>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      )}

      {phase === 'result' && picked && (
        <Animated.View entering={ZoomIn.springify().damping(14)}>
          <Card variant="glow" gradient={Gradients.accent} padding={Spacing.xl}>
            <View style={styles.resultHead}>
              <Text variant="overline" color="accent">
                {t('decide.result')}
              </Text>
              <View style={[styles.openPill, { backgroundColor: `${colors.success}22` }]}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text variant="caption" color="success">
                  {t('decide.openNow')}
                </Text>
              </View>
            </View>
            <Text variant="display">{picked.place.name}</Text>
            <PlaceMeta {...picked.place} />
            {picked.place.address && (
              <View style={styles.row}>
                <Ionicons name="location-outline" size={16} color={colors.textMuted} />
                <Text variant="caption" color="textSecondary" style={styles.flex}>
                  {picked.place.address}
                </Text>
              </View>
            )}
            <Text variant="caption" color="textMuted">
              {t('decide.pickedFrom', { count: picked.pool })}
            </Text>
          </Card>
        </Animated.View>
      )}

      {(phase === 'idle' || phase === 'empty') && (
        <>
          <View style={styles.grid}>
            {GROUPS.map((g, i) => {
              const selected = g.key === group;
              return (
                <Animated.View key={g.key} entering={FadeInDown.delay(i * 40)} style={styles.cell}>
                  <Tap accessibilityRole="radio" accessibilityState={{ selected }} accessibilityLabel={t(`decide.groups.${g.key}`)} onPress={() => setGroup(g.key)} feedback="select" scaleTo={0.94}>
                    {selected ? (
                      <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
                        <Ionicons name={g.icon} size={26} color="#FFFFFF" />
                        <Text variant="caption" numberOfLines={1} style={styles.white}>
                          {t(`decide.groups.${g.key}`)}
                        </Text>
                      </LinearGradient>
                    ) : (
                      <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth * 2 }]}>
                        <Ionicons name={g.icon} size={26} color={colors.textSecondary} />
                        <Text variant="caption" numberOfLines={1}>
                          {t(`decide.groups.${g.key}`)}
                        </Text>
                      </View>
                    )}
                  </Tap>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text variant="overline" color="textMuted">
              {t('decide.distance')}
            </Text>
            <View style={styles.row}>
              <Chip icon="walk-outline" label={t('decide.walk')} selected={distance === 'walk'} onPress={() => setDistance('walk')} />
              <Chip icon="bicycle-outline" label={t('decide.ride')} selected={distance === 'ride'} onPress={() => setDistance('ride')} />
            </View>
          </View>

          <Card padding={Spacing.md}>
            <View style={styles.row}>
              <Ionicons name="star" size={18} color={colors.warning} />
              <Text variant="body" style={styles.flex}>
                {t('decide.topRated')}
              </Text>
              <Switch value={topRated} onValueChange={setTopRated} trackColor={{ true: colors.primary, false: colors.surfaceStrong }} accessibilityLabel={t('decide.topRated')} />
            </View>
          </Card>

          {phase === 'empty' && (
            <Text variant="body" color="warning">
              {t('decide.noneLeft')}
            </Text>
          )}
          {needsLocation && (
            <Text variant="caption" color={location.status === 'denied' ? 'warning' : 'textMuted'}>
              {location.status === 'denied' ? t('nearby.locationDenied') : t('explore.needLocation')}
            </Text>
          )}
          {errorCode && (
            <View style={styles.section}>
              <Text variant="body" color={errorCode === 'quota_exceeded' ? 'warning' : 'danger'}>
                {t(`nearby.errors.${errorCode}` as 'nearby.errors.network')}
              </Text>
              {errorCode === 'quota_exceeded' && <UpgradeButton />}
              {errorCode === 'quota_exceeded' && <RewardedButton feature="nearby_search" onRewarded={() => setErrorCode(null)} />}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  section: { gap: Spacing.sm },
  footer: { gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -Spacing.xs },
  cell: { width: '33.333%', padding: Spacing.xs },
  tile: { alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, height: 96, borderRadius: Radius.lg, paddingHorizontal: Spacing.xs },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.8)' },
  center: { textAlign: 'center' },
  reelWrap: { borderRadius: Radius.xl, shadowColor: '#7C5CFF', shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  reel: { height: 260, borderRadius: Radius.xl, alignItems: 'center', justifyContent: 'center', gap: Spacing.md, padding: Spacing.xl, overflow: 'hidden' },
  reelRing: { position: 'absolute', width: 340, height: 340, borderRadius: 170, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  resultHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  openPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
