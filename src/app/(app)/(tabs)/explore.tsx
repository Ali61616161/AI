import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeOut, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Aurora } from '@/components/ui/aurora';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { ExploreMap } from '@/features/explore/explore-map';
import { distanceM, type Coords, type ExploreMapHandle } from '@/features/explore/types';
import { formatDistance, NEARBY_CATEGORY_LIST, openDirections, PlacesError, useOpenNow, type NearbyCategory, type Place } from '@/features/places/api';
import { openPlaceCard } from '@/features/places/place-card-api';
import { PlaceMeta } from '@/features/places/place-row';
import { useDeviceLocation } from '@/features/places/use-device-location';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { RewardedButton } from '@/features/ads/rewarded-button';

const CARD_GAP = Spacing.md;
const TAB_BAR = 96;
const CAROUSEL_H = 150;
/** Merkez bu kadar kayınca "Bu bölgede ara" çıkar. */
const MOVE_THRESHOLD_M = 450;

function LiveDot() {
  const { colors } = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1200 }), -1, false));
  }, [p]);
  const ring = useAnimatedStyle(() => ({ opacity: 1 - p.get(), transform: [{ scale: 1 + p.get() * 1.6 }] }));
  return (
    <View style={styles.liveDotWrap}>
      <Animated.View style={[styles.liveDot, styles.liveRing, { backgroundColor: colors.success }, ring]} />
      <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
    </View>
  );
}

export default function ExploreScreen() {
  const { t, i18n } = useTranslation();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const session = useSessionStore((s) => s.session);
  const location = useDeviceLocation();
  const [liveUser, setLiveUser] = useState<Coords | null>(null);
  const [searchedAt, setSearchedAt] = useState<Coords | null>(null);
  const [movedTo, setMovedTo] = useState<Coords | null>(null);
  const [category, setCategory] = useState<NearbyCategory>('restaurant');
  const [chosenId, setChosenId] = useState<string | null>(null);
  // İlk konum gelince harita ve arama oraya oturur; sonra konum canlı izlenir.
  const user = liveUser ?? location.coords;
  const searchCenter = searchedAt ?? location.coords;
  const mapCenter = movedTo ?? searchCenter;
  const map = useRef<ExploreMapHandle>(null);
  const list = useRef<FlatList<Place>>(null);
  const cardWidth = Math.min(width - Spacing.xl * 2, 420);

  const hasLocation = location.coords !== null;
  useEffect(() => {
    if (!hasLocation) return;
    let sub: Location.LocationSubscription | null = null;
    Location.watchPositionAsync({ accuracy: Location.Accuracy.Balanced, distanceInterval: 25 }, (pos) =>
      setLiveUser({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
    )
      .then((s) => (sub = s))
      .catch(() => undefined);
    return () => sub?.remove();
  }, [hasLocation]);

  const query = useOpenNow(category, searchCenter, { radius: 2000, limit: 20 });
  const places = useMemo(() => (query.data ?? []).filter((p) => p.lat !== null && p.lng !== null), [query.data]);
  const icon = NEARBY_CATEGORY_LIST.find((c) => c.key === category)?.icon.replace('-outline', '') as 'restaurant';
  const moved = mapCenter && searchCenter ? distanceM(mapCenter, searchCenter) > MOVE_THRESHOLD_M : false;
  const errorCode = query.error instanceof PlacesError ? query.error.code : query.error ? 'network' : null;

  // Seçim yeni sonuçlarda yoksa ilk yer seçili sayılır.
  const selectedId = chosenId && places.some((p) => p.id === chosenId) ? chosenId : (places[0]?.id ?? null);
  useEffect(() => {
    list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [places]);

  function select(id: string, from: 'map' | 'list') {
    setChosenId(id);
    const index = places.findIndex((p) => p.id === id);
    const p = places[index];
    if (!p) return;
    if (from === 'map') list.current?.scrollToIndex({ index, animated: true });
    map.current?.flyTo({ lat: p.lat!, lng: p.lng! });
  }

  if (!session || !isSupabaseConfigured()) {
    return (
      <View style={[styles.fill, { paddingTop: insets.top + Spacing.lg, paddingHorizontal: Spacing.xl }]}>
        <Aurora />
        <EmptyState icon="map" title={t('explore.title')} description={t('ticket.accountRequiredBody')} />
      </View>
    );
  }

  if (!searchCenter) {
    const denied = location.status === 'denied';
    return (
      <View style={[styles.fill, styles.center, { paddingHorizontal: Spacing.xl }]}>
        <Aurora />
        <EmptyState icon="navigate" title={t('explore.title')} description={denied ? t('nearby.locationDenied') : t('explore.needLocation')}>
          <Button title={t('nearby.useLocation')} icon="locate" loading={location.status === 'locating' || location.status === 'checking'} onPress={location.request} />
        </EmptyState>
      </View>
    );
  }

  const top = insets.top + Spacing.sm;
  const overlayTop = top + 104;
  const bottom = TAB_BAR + insets.bottom;

  return (
    <View style={[styles.fill, { backgroundColor: colors.background }]}>
      <ExploreMap
        ref={map}
        center={searchCenter}
        user={user}
        places={places}
        selectedId={selectedId}
        icon={icon}
        onSelect={(id) => select(id, 'map')}
        onMove={setMovedTo}
        topInset={overlayTop - insets.top}
        bottomInset={bottom + CAROUSEL_H}
      />

      {/* Üst katman: başlık, canlı durum ve kategoriler */}
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: top }]}>
        <View style={styles.headerRow}>
          <View style={[styles.glass, styles.livePill, { backgroundColor: isDark ? 'rgba(7,11,22,0.78)' : 'rgba(255,255,255,0.9)', borderColor: colors.border }]}>
            <LiveDot />
            <Text variant="caption" numberOfLines={1}>
              {t('explore.live')}
              {query.data ? ` · ${t('explore.openCount', { count: places.length })}` : ''}
            </Text>
          </View>
          <Tap accessibilityRole="button" accessibilityLabel={t('today.quick.travelers')} onPress={() => router.push('/social')} feedback="select">
            <View style={[styles.glass, styles.roundBtn, { backgroundColor: isDark ? 'rgba(7,11,22,0.78)' : 'rgba(255,255,255,0.9)', borderColor: colors.border }]}>
              <Ionicons name="people" size={20} color={colors.text} />
            </View>
          </Tap>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {NEARBY_CATEGORY_LIST.map((c) => (
            <View key={c.key} style={[styles.chipShadow, { backgroundColor: isDark ? 'rgba(7,11,22,0.72)' : 'rgba(255,255,255,0.92)' }]}>
              <Chip icon={c.icon} label={t(`nearby.categories.${c.key}`)} selected={c.key === category} onPress={() => setCategory(c.key)} />
            </View>
          ))}
        </ScrollView>
        {moved && (
          <Animated.View entering={FadeInDown} exiting={FadeOut} style={styles.searchArea}>
            <Button
              title={t('explore.searchArea')}
              icon="refresh"
              size="sm"
              onPress={() => setSearchedAt(mapCenter)}
            />
          </Animated.View>
        )}
      </View>

      {/* Konuma dön */}
      {Platform.OS !== 'web' && (
        <Tap
          accessibilityRole="button"
          accessibilityLabel={t('explore.locate')}
          feedback="select"
          onPress={() => user && map.current?.flyTo(user)}
          style={[styles.locate, { bottom: bottom + CAROUSEL_H + Spacing.md }]}>
          <View style={[styles.glass, styles.roundBtn, { backgroundColor: isDark ? 'rgba(7,11,22,0.85)' : 'rgba(255,255,255,0.95)', borderColor: colors.border }]}>
            <Ionicons name="locate" size={20} color={colors.primary} />
          </View>
        </Tap>
      )}

      {/* Alt kart şeridi */}
      <View style={[styles.carousel, { bottom, height: CAROUSEL_H }]}>
        {query.isLoading ? (
          <View style={[styles.cardBox, { width: cardWidth, marginLeft: Spacing.xl, backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            <Skeleton width="60%" height={18} />
            <Skeleton width="40%" height={12} />
            <Skeleton width="80%" height={12} />
          </View>
        ) : errorCode ? (
          <View style={[styles.cardBox, { width: cardWidth, marginLeft: Spacing.xl, backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            <Text variant="body" color={errorCode === 'quota_exceeded' ? 'warning' : 'danger'}>
              {t(`nearby.errors.${errorCode}` as 'nearby.errors.network')}
            </Text>
            {errorCode === 'quota_exceeded' ? (
              <View style={styles.cardRow}>
                <UpgradeButton />
                <RewardedButton feature="nearby_search" onRewarded={() => query.refetch()} />
              </View>
            ) : (
              <Button title={t('common.retry')} variant="secondary" size="sm" onPress={() => query.refetch()} />
            )}
          </View>
        ) : places.length === 0 ? (
          <View style={[styles.cardBox, { width: cardWidth, marginLeft: Spacing.xl, backgroundColor: colors.backgroundElevated, borderColor: colors.border }]}>
            <Text variant="body" color="textSecondary">
              {t('nearby.empty')}
            </Text>
          </View>
        ) : (
          <FlatList
            ref={list}
            data={places}
            keyExtractor={(p) => p.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={cardWidth + CARD_GAP}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: Spacing.xl, gap: CARD_GAP }}
            onScrollToIndexFailed={() => undefined}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / (cardWidth + CARD_GAP));
              const p = places[index];
              if (p && p.id !== selectedId) select(p.id, 'list');
            }}
            renderItem={({ item, index }) => {
              const live = user && item.lat !== null && item.lng !== null ? distanceM(user, { lat: item.lat, lng: item.lng }) : item.distanceM;
              const selected = item.id === selectedId;
              return (
                <Animated.View entering={FadeIn.delay(index * 40)} style={{ width: cardWidth }}>
                  <Card variant={selected ? 'glow' : 'solid'} padding={Spacing.lg} onPress={() => (selected ? openPlaceCard({ id: item.id, name: item.name, address: item.address, lat: item.lat, lng: item.lng, mapsUrl: item.mapsUrl }) : select(item.id, 'list'))} accessibilityLabel={item.name}>
                    <View style={styles.cardRow}>
                      <IconBadge icon={icon} tone={selected ? 'gradient' : 'soft'} size={46} />
                      <View style={styles.flex}>
                        <Text variant="bodyStrong" numberOfLines={1}>
                          {item.name}
                        </Text>
                        <PlaceMeta rating={item.rating} ratingCount={item.ratingCount} priceLevel={item.priceLevel} distanceM={null} />
                        <View style={styles.cardRow}>
                          <View style={[styles.openDot, { backgroundColor: colors.success }]} />
                          <Text variant="caption" color="success">
                            {t('decide.openNow')}
                          </Text>
                          {live !== null && (
                            <Text variant="caption" color="textSecondary">
                              · {formatDistance(live, i18n.language)}
                            </Text>
                          )}
                        </View>
                      </View>
                      <Tap
                        accessibilityRole="button"
                        accessibilityLabel={t('decide.go')}
                        onPress={() => openDirections({ name: item.name, lat: item.lat, lng: item.lng, address: item.address })}
                        feedback="press">
                        <View style={[styles.go, { backgroundColor: colors.primary }]}>
                          <Ionicons name="navigate" size={18} color="#FFFFFF" />
                        </View>
                      </Tap>
                    </View>
                  </Card>
                </Animated.View>
              );
            }}
          />
        )}
      </View>
      {Platform.OS === 'web' && (
        <View pointerEvents="none" style={[styles.webNote, { bottom: bottom + CAROUSEL_H + Spacing.xs }]}>
          <Text variant="caption" color="textMuted">
            {t('explore.radar')}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { justifyContent: 'center' },
  flex: { flex: 1, gap: 3 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.xl },
  glass: { borderWidth: StyleSheet.hairlineWidth * 2, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, height: 40, borderRadius: Radius.pill, flexShrink: 1 },
  liveDotWrap: { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveRing: { position: 'absolute' },
  roundBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  chips: { paddingHorizontal: Spacing.xl, gap: Spacing.sm },
  chipShadow: { borderRadius: Radius.pill },
  searchArea: { alignSelf: 'center' },
  locate: { position: 'absolute', right: Spacing.xl },
  carousel: { position: 'absolute', left: 0, right: 0, justifyContent: 'center' },
  cardBox: { padding: Spacing.lg, borderRadius: Radius.xl, gap: Spacing.sm, borderWidth: StyleSheet.hairlineWidth * 2 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  openDot: { width: 7, height: 7, borderRadius: 4 },
  go: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  webNote: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});
