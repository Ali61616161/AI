import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { freeDayKey } from '@/features/live/drift-logic';
import { GuidancePanel } from '@/features/live/guidance-panel';
import { currentStop, dayProgress, hopBetween, stopStatuses, type StopStatus } from '@/features/live/live-logic';
import { useLiveStore } from '@/features/live/live-store';
import { LiveMap } from '@/features/live/live-map';
import { NowStrip } from '@/features/live/now-strip';
import { scheduleStopNudges } from '@/features/live/nudges';
import type { LiveMapHandle } from '@/features/live/types';
import { useLiveGuidance } from '@/features/live/use-live-guidance';
import { useTripWeather } from '@/features/places/api';
import { openPlaceCard } from '@/features/places/place-card-api';
import { PlaceMeta } from '@/features/places/place-row';
import { DaySelector, openRoute } from '@/features/plan/plan-timeline';
import { decodePolyline, thin } from '@/features/transport/polyline';
import { useActivePlan, useTrip, type PlanItemRow } from '@/features/trips/queries';
import { formatTime, todayIsoDate } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const CARD_GAP = Spacing.md;

type Stop = PlanItemRow & { lat: number; lng: number };
type ViewMode = 'cards' | 'list';

/**
 * Seyahat canlı görünümü: tam ekran harita, durumuna göre renklenen duraklar, konumundan sıradaki
 * durağa güzergah, "ne zaman çıkmalıyım" şeridi, varınca "geldin mi?" sorusu, kart ya da liste görünümü.
 */
export default function TripLiveScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan, isPending } = useActivePlan(tripId);
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);
  const weather = useTripWeather(tripId);
  const days = plan?.day_plans ?? [];
  // "Şimdi / Sıradaki" ve geri sayımlar dakikada bir yenilenir.
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
  const isToday = activeDay?.date === today;

  const stops = useMemo<Stop[]>(
    () => (activeDay?.plan_items ?? []).filter((i): i is Stop => i.lat !== null && i.lng !== null && i.kind !== 'transport'),
    [activeDay],
  );
  const current = isToday ? currentStop(stops, nowMs) : null;

  // Canlı rehberlik: konum, sıradaki durağa yol süresi, gecikmiş durak, havalimanı, varış algılama.
  // "Gittim / atla" işaretleri yalnızca bu telefonda tutulur (paylaşılan seyahati görüntüleyen de işaretleyebilir).
  const mark = useLiveStore((s) => s.mark);
  const setFreeDay = useLiveStore((s) => s.setFreeDay);
  const guidance = useLiveGuidance({ trip, tripId, date: activeDay?.date ?? null, stops, isToday, nowMs });
  const statuses = useMemo<StopStatus[] | null>(() => (isToday ? stopStatuses(stops, nowMs, guidance.marks) : null), [isToday, stops, nowMs, guidance.marks]);
  const progress = dayProgress(statuses ?? []);
  const freeKey = activeDay ? freeDayKey(tripId, activeDay.date) : null;
  const leaveAt = guidance.leaveAt;
  const flightTitle = guidance.airportName;
  useEffect(() => {
    if (!isToday) return;
    const extra = leaveAt !== null ? { id: 'leave', at: new Date(leaveAt), title: t('live.guidance.leaveNowTitle'), body: t('live.guidance.leaveNowBody', { airport: flightTitle ?? '' }) } : undefined;
    scheduleStopNudges(tripId, stops, guidance.marks, guidance.freeDay, extra).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, isToday, stops, guidance.marks, guidance.freeDay, leaveAt]);

  const [choice, setChoice] = useState<{ day: string; id: string } | null>(null);
  const defaultId = current ? stops[current.index]?.id : stops[0]?.id;
  const selectedId = (choice && choice.day === activeDay?.id ? choice.id : null) ?? defaultId ?? null;
  const selectedIndex = Math.max(
    stops.findIndex((s) => s.id === selectedId),
    0,
  );

  // Varınca: "geldin mi?" (bir kez sorulur; "şimdi değil" denirse o durak için tekrar sorulmaz).
  const [dismissedArrival, setDismissedArrival] = useState<string[]>([]);
  const arrived = guidance.arrived && !dismissedArrival.includes(guidance.arrived.id) ? guidance.arrived : null;
  const arrivedId = arrived?.id ?? null;
  useEffect(() => {
    if (arrivedId) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [arrivedId]);

  const toggleMark = (id: string, value: 'done' | 'skipped') => {
    const next = guidance.marks[id] === value ? null : value;
    mark(id, next);
    if (next) Haptics.selectionAsync().catch(() => undefined);
  };

  // Konumundan sıradaki durağa gerçek güzergah çizgisi (rota zaten süre için isteniyor; ek istek yok).
  const guide = useMemo(() => {
    const polyline = guidance.etaRoute?.polyline;
    if (!isToday || !polyline) return null;
    return { coords: thin(decodePolyline(polyline), 400), mode: guidance.etaMode };
  }, [isToday, guidance.etaRoute?.polyline, guidance.etaMode]);

  const [mode, setMode] = useState<ViewMode>('cards');
  const map = useRef<LiveMapHandle>(null);
  const list = useRef<FlatList<Stop>>(null);
  const cardWidth = Math.min(width - Spacing.lg * 2 - 24, 420);
  const interval = cardWidth + CARD_GAP;
  // Haritanın üstte ve altta kaplanan alanları ölçülür; duraklar bu boşluğa sığdırılır.
  const [topHeight, setTopHeight] = useState(insets.top + 110);
  const [bottomHeight, setBottomHeight] = useState(260);

  const select = (id: string, scroll: boolean) => {
    if (!activeDay) return;
    setChoice({ day: activeDay.id, id });
    map.current?.focus(id);
    const index = stops.findIndex((s) => s.id === id);
    if (scroll && mode === 'cards' && index >= 0) list.current?.scrollToIndex({ index, animated: true });
  };

  const top = insets.top + 8;
  const numberFormat = new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 1 });
  const hopText = (index: number) => {
    const prev = index > 0 ? stops[index - 1] : null;
    if (!prev) return null;
    const hop = hopBetween(prev, stops[index]);
    return hop.walkMin !== null ? t('live.hopWalk', { min: hop.walkMin, km: numberFormat.format(hop.km) }) : t('live.hopFar', { km: numberFormat.format(hop.km) });
  };
  const statusBadge = (status: StopStatus | undefined) => {
    if (!status || status === 'later') return null;
    const tone = status === 'now' ? colors.success : status === 'next' ? colors.primary : colors.textMuted;
    return (
      <View style={[styles.badge, { backgroundColor: tone }]}>
        <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
          {t(`live.status.${status}`)}
        </Text>
      </View>
    );
  };
  const markButtons = (item: Stop) =>
    isToday ? (
      <>
        <Chip icon={guidance.marks[item.id] === 'done' ? 'checkmark-circle' : 'checkmark-circle-outline'} label={t('live.guidance.went')} selected={guidance.marks[item.id] === 'done'} onPress={() => toggleMark(item.id, 'done')} />
        <Chip icon="play-skip-forward-outline" label={t('live.guidance.skip')} selected={guidance.marks[item.id] === 'skipped'} onPress={() => toggleMark(item.id, 'skipped')} />
      </>
    ) : null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {stops.length > 0 && (
        <LiveMap
          ref={map}
          points={stops.map((s, i) => ({ id: s.id, lat: s.lat, lng: s.lng, title: s.place_name ?? s.title, label: String(i + 1), locked: s.is_locked, status: statuses?.[i] }))}
          selectedId={selectedId}
          onSelect={(id) => select(id, true)}
          guide={guide}
          here={guidance.here}
          topInset={topHeight}
          bottomInset={bottomHeight}
        />
      )}

      <View style={[styles.top, { paddingTop: top }]} pointerEvents="box-none" onLayout={(e) => setTopHeight(e.nativeEvent.layout.height)}>
        <View style={styles.titleRow}>
          <Tap accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} hitSlop={12} feedback="press">
            <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
          {stops.length > 0 && (
            <Tap
              accessibilityRole="button"
              accessibilityLabel={mode === 'cards' ? t('live.viewList') : t('live.viewCards')}
              onPress={() => setMode((m) => (m === 'cards' ? 'list' : 'cards'))}
              hitSlop={12}
              feedback="select">
              <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name={mode === 'cards' ? 'list' : 'albums-outline'} size={20} color={colors.text} />
              </View>
            </Tap>
          )}
        </View>
        {days.length > 0 && <DaySelector days={days} selected={dayIndex} onSelect={setPickedDay} />}
        {freeKey && (
          <View style={styles.chipRow}>
            <Chip icon={guidance.freeDay ? 'checkmark-circle' : 'sunny-outline'} label={t('live.freeDay')} selected={guidance.freeDay} onPress={() => setFreeDay(freeKey, !guidance.freeDay)} />
            {isToday && <Chip icon="cafe-outline" label={t('live.nearby')} onPress={() => router.dismissTo('/explore')} />}
          </View>
        )}
        {isToday && stops.length > 0 && (
          <NowStrip guidance={guidance} progress={progress} weather={weather.data?.days.find((w) => w.date === today) ?? null} timezone={stops[0]?.timezone ?? null} />
        )}
      </View>

      {stops.length > 0 && (
        <View style={[styles.controls, { bottom: bottomHeight + Spacing.sm }]} pointerEvents="box-none">
          {guidance.here && (
            <Tap accessibilityRole="button" accessibilityLabel={t('live.locate')} onPress={() => map.current?.locate()} feedback="select">
              <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="locate" size={20} color={colors.primary} />
              </View>
            </Tap>
          )}
          <Tap accessibilityRole="button" accessibilityLabel={t('live.fitAll')} onPress={() => map.current?.fit()} feedback="select">
            <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="scan-outline" size={20} color={colors.text} />
            </View>
          </Tap>
        </View>
      )}

      {isPending ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : stops.length === 0 ? (
        <View style={[styles.center, styles.pad]}>
          <EmptyState icon="map-outline" title={t('live.emptyTitle')} description={t('live.emptyBody')} />
        </View>
      ) : (
        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md }]} pointerEvents="box-none" onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}>
          {isToday && (
            <View style={styles.guidance}>
              {arrived && (
                <Card variant="glow" padding={Spacing.md}>
                  <View style={styles.row}>
                    <Ionicons name="location" size={22} color={colors.success} />
                    <Text variant="bodyStrong" style={styles.flex}>
                      {t('live.arrivedTitle', { title: arrived.title })}
                    </Text>
                  </View>
                  <View style={styles.actions}>
                    <Button
                      title={t('live.arrivedYes')}
                      onPress={() => {
                        mark(arrived.id, 'done');
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
                      }}
                      style={styles.flex}
                    />
                    <Button title={t('live.notNow')} variant="secondary" onPress={() => setDismissedArrival((d) => [...d, arrived.id])} style={styles.flex} />
                  </View>
                </Card>
              )}
              <GuidancePanel tripId={tripId} guidance={guidance} timezone={stops[0]?.timezone ?? null} nowMs={nowMs} canEdit={!trip || trip.owner_id === userId} />
            </View>
          )}

          {mode === 'list' ? (
            <View style={[styles.listBox, { maxHeight: height * 0.42, backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ScrollView contentContainerStyle={styles.listContent}>
                {stops.map((item, index) => {
                  const status = statuses?.[index];
                  const muted = status === 'done' || status === 'skipped' || status === 'past';
                  const active = item.id === selectedId;
                  return (
                    <Tap key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => select(item.id, false)} feedback="select">
                      <View style={[styles.listRow, active && { backgroundColor: colors.surfaceMuted }, muted && styles.muted]}>
                        <View style={[styles.number, { backgroundColor: status === 'now' ? colors.success : active ? colors.primary : colors.surfaceMuted }]}>
                          {status === 'done' || status === 'skipped' ? (
                            <Ionicons name={status === 'done' ? 'checkmark' : 'close'} size={14} color={colors.text} />
                          ) : (
                            <Text variant="caption" style={{ color: active || status === 'now' ? colors.onPrimary : colors.text, fontWeight: '800' }}>
                              {index + 1}
                            </Text>
                          )}
                        </View>
                        <View style={styles.flex}>
                          <Text variant="bodyStrong" numberOfLines={1} style={status === 'skipped' ? styles.strike : undefined}>
                            {item.title}
                          </Text>
                          <Text variant="caption" color="textMuted" numberOfLines={1}>
                            {[item.starts_at ? formatTime(item.starts_at, item.timezone) : null, hopText(index)].filter(Boolean).join(' · ')}
                          </Text>
                        </View>
                        {statusBadge(status)}
                      </View>
                    </Tap>
                  );
                })}
              </ScrollView>
            </View>
          ) : (
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
              getItemLayout={(_, index) => ({ length: interval, offset: interval * index, index })}
              extraData={`${statuses?.join(',')}|${selectedId}`}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / interval);
                const stop = stops[Math.min(Math.max(index, 0), stops.length - 1)];
                if (stop && stop.id !== selectedId) select(stop.id, false);
              }}
              renderItem={({ item, index }) => {
                const prev = index > 0 ? stops[index - 1] : null;
                const status = statuses?.[index];
                const active = item.id === selectedId;
                const muted = status === 'done' || status === 'skipped';
                const time = item.starts_at ? formatTime(item.starts_at, item.timezone) : null;
                const hop = hopText(index);
                return (
                  <View style={[{ width: cardWidth }, muted && styles.muted]}>
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
                        {statusBadge(status)}
                      </View>
                      <Text variant="subtitle" numberOfLines={2} style={status === 'skipped' ? styles.strike : undefined}>
                        {item.title}
                      </Text>
                      {item.rating !== null && <PlaceMeta rating={item.rating} ratingCount={item.rating_count} priceLevel={null} distanceM={null} />}
                      {hop && (
                        <Text variant="caption" color="textMuted" numberOfLines={1}>
                          {hop}
                        </Text>
                      )}
                      <View style={styles.actions}>
                        <Chip icon="navigate-outline" label={t('route.howToGet')} onPress={() => openRoute(item, prev, city, tripId)} />
                        {item.google_place_id && (
                          <Chip
                            icon="images-outline"
                            label={t('place.details')}
                            onPress={() => openPlaceCard({ id: item.google_place_id!, name: item.place_name ?? item.title, address: item.address, lat: item.lat, lng: item.lng, mapsUrl: item.maps_url })}
                          />
                        )}
                        {markButtons(item)}
                      </View>
                    </Card>
                  </View>
                );
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.sm, paddingBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  round: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: Spacing.xl },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.sm },
  guidance: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: Spacing.lg },
  controls: { position: 'absolute', right: Spacing.lg, gap: Spacing.sm },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  number: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  muted: { opacity: 0.6 },
  strike: { textDecorationLine: 'line-through' },
  listBox: { marginHorizontal: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  listContent: { paddingVertical: Spacing.xs },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
