import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { currentStop, hopBetween } from '@/features/live/live-logic';
import { LiveMap } from '@/features/live/live-map';
import type { LiveMapHandle } from '@/features/live/types';
import { openPlaceCard } from '@/features/places/place-card-api';
import { PlaceMeta } from '@/features/places/place-row';
import { DaySelector, openRoute } from '@/features/plan/plan-timeline';
import { useActivePlan, useTrip, type PlanItemRow } from '@/features/trips/queries';
import { formatTime, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const CARD_GAP = Spacing.md;
const BOTTOM_AREA = 250;

type Stop = PlanItemRow & { lat: number; lng: number };

/** Seyahat canlı görünümü: tam ekran harita, numaralı duraklar ve kaydırmalı durak kartları. */
export default function TripLiveScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan, isPending } = useActivePlan(tripId);
  const days = plan?.day_plans ?? [];
  // "Şimdi / Sıradaki" rozeti dakikada bir yenilenir.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const today = todayIsoDate();

  const [pickedDay, setPickedDay] = useState<number | null>(() => (day !== undefined && Number.isInteger(Number(day)) ? Number(day) : null));
  const todayIndex = days.findIndex((d) => d.date === today);
  const dayIndex = Math.min(pickedDay ?? (todayIndex >= 0 ? todayIndex : 0), Math.max(days.length - 1, 0));
  const activeDay = days[dayIndex];
  const city = activeDay?.city ?? trip?.trip_destinations[0]?.city ?? null;

  const stops = useMemo<Stop[]>(
    () => (activeDay?.plan_items ?? []).filter((i): i is Stop => i.lat !== null && i.lng !== null && i.kind !== 'transport'),
    [activeDay],
  );
  const current = activeDay && activeDay.date === today ? currentStop(stops, nowMs) : null;

  const [choice, setChoice] = useState<{ day: string; id: string } | null>(null);
  const defaultId = current ? stops[current.index]?.id : stops[0]?.id;
  const selectedId = (choice && choice.day === activeDay?.id ? choice.id : null) ?? defaultId ?? null;
  const selectedIndex = Math.max(
    stops.findIndex((s) => s.id === selectedId),
    0,
  );

  const map = useRef<LiveMapHandle>(null);
  const list = useRef<FlatList<Stop>>(null);
  const cardWidth = Math.min(width - Spacing.lg * 2 - 24, 420);
  const interval = cardWidth + CARD_GAP;

  const select = (id: string, scroll: boolean) => {
    if (!activeDay) return;
    setChoice({ day: activeDay.id, id });
    map.current?.focus(id);
    const index = stops.findIndex((s) => s.id === id);
    if (scroll && index >= 0) list.current?.scrollToIndex({ index, animated: true });
  };

  const top = insets.top + 8;
  const topInset = top + 96;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {stops.length > 0 && (
        <LiveMap
          ref={map}
          points={stops.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, title: s.place_name ?? s.title, label: String(i + 1), locked: s.is_locked }))}
          selectedId={selectedId}
          onSelect={(id) => select(id, true)}
          topInset={topInset}
          bottomInset={BOTTOM_AREA + insets.bottom}
        />
      )}

      <View style={[styles.top, { paddingTop: top }]} pointerEvents="box-none">
        <View style={styles.titleRow}>
          <Tap accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} hitSlop={12} feedback="press">
            <View style={[styles.close, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="close" size={20} color={colors.text} />
            </View>
          </Tap>
          <View style={styles.flex}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {trip?.title ?? ''}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {t('live.subtitle', { city: city ?? '', count: stops.length })}
            </Text>
          </View>
        </View>
        {days.length > 0 && <DaySelector days={days} selected={dayIndex} onSelect={setPickedDay} />}
      </View>

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : stops.length === 0 ? (
        <View style={[styles.center, styles.pad]}>
          <EmptyState icon="map-outline" title={t('live.emptyTitle')} description={t('live.emptyBody')} />
        </View>
      ) : (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md }]} pointerEvents="box-none">
          <FlatList
            // Gün değişince liste yeniden kurulur ve seçili durağa kayar.
            key={activeDay?.id}
            ref={list}
            horizontal
            data={stops}
            keyExtractor={(s) => s.id}
            showsHorizontalScrollIndicator={false}
            snapToInterval={interval}
            decelerationRate="fast"
            contentContainerStyle={{ paddingHorizontal: Spacing.lg, gap: CARD_GAP }}
            initialScrollIndex={selectedIndex}
            getItemLayout={(_, index) => ({ length: interval, offset: Spacing.lg + interval * index - Spacing.lg, index })}
            onMomentumScrollEnd={(e) => {
              const index = Math.round(e.nativeEvent.contentOffset.x / interval);
              const stop = stops[Math.min(Math.max(index, 0), stops.length - 1)];
              if (stop && stop.id !== selectedId) select(stop.id, false);
            }}
            renderItem={({ item, index }) => {
              const prev = index > 0 ? stops[index - 1] : null;
              const hop = prev ? hopBetween(prev, item) : null;
              const state = current && current.index === index ? current.state : null;
              const active = item.id === selectedId;
              const time = item.starts_at ? formatTime(item.starts_at, item.timezone) : null;
              return (
                <View style={{ width: cardWidth }}>
                  <Card variant={active ? 'glow' : 'solid'} padding={Spacing.lg} onPress={() => select(item.id, true)} accessibilityLabel={item.title}>
                    <View style={styles.cardHead}>
                      <View style={[styles.number, { backgroundColor: active ? colors.primary : colors.surfaceMuted }]}>
                        <Text variant="caption" style={{ color: active ? colors.onPrimary : colors.text, fontWeight: '800' }}>
                          {index + 1}
                        </Text>
                      </View>
                      {time && (
                        <Text variant="caption" color="textSecondary">
                          {time}
                        </Text>
                      )}
                      {state && state !== 'done' && (
                        <View style={[styles.badge, { backgroundColor: state === 'now' ? colors.success : colors.primary }]}>
                          <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                            {t(`live.${state}`)}
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text variant="subtitle" numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.rating !== null && <PlaceMeta rating={item.rating} ratingCount={item.rating_count} priceLevel={null} distanceM={null} />}
                    {hop && (
                      <Text variant="caption" color="textMuted" numberOfLines={1}>
                        {hop.walkMin !== null
                          ? t('live.hopWalk', { min: hop.walkMin, km: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(hop.km) })
                          : t('live.hopFar', { km: new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 }).format(hop.km) })}
                      </Text>
                    )}
                    <View style={styles.actions}>
                      {item.google_place_id && (
                        <Chip
                          icon="images-outline"
                          label={t('place.details')}
                          onPress={() => openPlaceCard({ id: item.google_place_id!, name: item.place_name ?? item.title, address: item.address, lat: item.lat, lng: item.lng, mapsUrl: item.maps_url })}
                        />
                      )}
                      <Chip icon="git-branch-outline" label={t('route.howToGet')} onPress={() => openRoute(item, prev, city)} />
                    </View>
                  </Card>
                </View>
              );
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.sm, paddingBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  close: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: Spacing.xl },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  number: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
});
