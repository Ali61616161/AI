import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { DayEndCard, DayEndedCard, DayStartCard } from '@/features/live/day-cards';
import { freeDayKey } from '@/features/live/drift-logic';
import { GuidancePanel } from '@/features/live/guidance-panel';
import { activeStopIndex, daySummary, flowStatuses, remainingIds } from '@/features/live/live-flow';
import { LiveHero, type LiveStopRow } from '@/features/live/live-hero';
import { hopBetween } from '@/features/live/live-logic';
import { useLiveStore } from '@/features/live/live-store';
import { LiveMap } from '@/features/live/live-map';
import { LiveTimeline } from '@/features/live/live-timeline';
import { scheduleStopNudges } from '@/features/live/nudges';
import type { LiveMapHandle } from '@/features/live/types';
import { useLiveGuidance } from '@/features/live/use-live-guidance';
import { useTripWeather } from '@/features/places/api';
import { openPlaceCard } from '@/features/places/place-card-api';
import { useCrisisReplan } from '@/features/plan/replan';
import { DaySelector, openRoute } from '@/features/plan/plan-timeline';
import { decodePolyline, thin } from '@/features/transport/polyline';
import { useActivePlan, useTrip } from '@/features/trips/queries';
import { todayIsoDate } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Yağmur olasılığı bu yüzdeyi geçince açık hava duraklarına kapalı alternatif önerilir. */
const RAIN_WARN_PCT = 60;

/**
 * Seyahat canlı görünümü: üstte harita, altta tek odak. Odak, şu an ya da sıradaki durak; büyük tek düğme
 * günü ilerletir (yola çık → vardım → bitirdim). Varış konumdan algılanır; gün başlatılıp bitirilebilir.
 */
export default function TripLiveScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { tripId, day } = useLocalSearchParams<{ tripId: string; day?: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan, isPending } = useActivePlan(tripId);
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);
  const weather = useTripWeather(tripId);
  const replan = useCrisisReplan();
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
  const canEdit = !trip || trip.owner_id === userId;
  const timezone = activeDay?.plan_items.find((i) => i.timezone)?.timezone ?? null;

  const stops = useMemo<LiveStopRow[]>(
    () => (activeDay?.plan_items ?? []).filter((i): i is LiveStopRow => i.lat !== null && i.lng !== null && i.kind !== 'transport'),
    [activeDay],
  );
  // Gün tamamen boşsa ("plan yok") ile planı var ama konumu bulunamıyorsa ("konum yok") farklı anlatılır.
  const hasPlans = (activeDay?.plan_items ?? []).some((i) => i.kind !== 'transport');

  // "Gittim / atla / yoldayım / buradayım" ve günün başlayıp bitmesi yalnızca bu telefonda tutulur.
  const marks = useLiveStore((s) => s.marks);
  const steps = useLiveStore((s) => s.steps);
  const dayFlags = useLiveStore((s) => s.dayFlags);
  const mark = useLiveStore((s) => s.mark);
  const markMany = useLiveStore((s) => s.markMany);
  const setStep = useLiveStore((s) => s.setStep);
  const setFreeDay = useLiveStore((s) => s.setFreeDay);
  const setDayFlag = useLiveStore((s) => s.setDayFlag);

  const activeIndex = isToday ? activeStopIndex(stops, nowMs, marks, steps) : null;
  const activeStop = activeIndex !== null ? stops[activeIndex] : null;
  const activeId = activeStop?.id ?? null;
  // Canlı rehberlik: konum, odak durağa yol süresi, gecikmiş durak, havalimanı, varış algılama.
  const guidance = useLiveGuidance({ trip, tripId, date: activeDay?.date ?? null, stops, isToday, nowMs, target: activeStop && steps[activeStop.id] !== 'here' ? activeStop : null });
  const statuses = useMemo(() => (isToday ? flowStatuses(stops, nowMs, marks, steps) : null), [isToday, stops, nowMs, marks, steps]);
  const summary = daySummary(stops, marks);
  const finished = statuses ? statuses.filter((s) => s === 'done' || s === 'skipped' || s === 'past').length : 0;
  const ratio = stops.length ? finished / stops.length : 0;
  const freeKey = activeDay ? freeDayKey(tripId, activeDay.date) : null;
  const freeDay = guidance.freeDay;
  const dayFlag = freeKey ? dayFlags[freeKey] : undefined;
  const hasProgress = stops.some((s) => marks[s.id] || steps[s.id]);
  const ended = dayFlag === 'ended';
  const allClosed = stops.length > 0 && activeIndex === null;
  const [endOpen, setEndOpen] = useState(false);

  const leaveAt = guidance.leaveAt;
  const flightTitle = guidance.airportName;
  useEffect(() => {
    if (!isToday) return;
    const extra = leaveAt !== null ? { id: 'leave', at: new Date(leaveAt), title: t('live.guidance.leaveNowTitle'), body: t('live.guidance.leaveNowBody', { airport: flightTitle ?? '' }) } : undefined;
    scheduleStopNudges(tripId, stops, guidance.marks, guidance.freeDay, extra).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripId, isToday, stops, guidance.marks, guidance.freeDay, leaveAt]);

  // Seçili durak: odak durak değişince seçim sıfırlanır (seçim hangi odakta yapıldığını hatırlar).
  const [choice, setChoice] = useState<{ day: string; id: string; at: string | null } | null>(null);
  const defaultId = activeId ?? stops[0]?.id;
  const selectedId = (choice && choice.day === activeDay?.id && choice.at === activeId ? choice.id : null) ?? defaultId ?? null;
  const selectedIndex = Math.max(
    stops.findIndex((s) => s.id === selectedId),
    0,
  );
  const selected = stops[selectedIndex] ?? null;
  const selectedStatus = statuses?.[selectedIndex] ?? 'later';

  const map = useRef<LiveMapHandle>(null);
  useEffect(() => {
    if (activeId) map.current?.focus(activeId);
  }, [activeId]);

  // Varınca otomatik "buradayım": konum durağa yeterince yakınsa adım kendiliğinden ilerler.
  const arrivedId = guidance.arrived?.id ?? null;
  useEffect(() => {
    if (!arrivedId || steps[arrivedId] === 'here') return;
    setStep(arrivedId, 'here');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrivedId]);

  // Konumundan odak durağa gerçek güzergah çizgisi (rota zaten süre için isteniyor; ek istek yok).
  const guide = useMemo(() => {
    const polyline = guidance.etaRoute?.polyline;
    if (!isToday || !polyline) return null;
    return { coords: thin(decodePolyline(polyline), 400), mode: guidance.etaMode };
  }, [isToday, guidance.etaRoute?.polyline, guidance.etaMode]);

  // Tam ekran harita: paneller gizlenir, yalnızca harita ve küçük düğmeler kalır.
  const [fullMap, setFullMap] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Haritanın üstte ve altta kaplanan alanları ölçülür; duraklar bu boşluğa sığdırılır.
  const [topHeight, setTopHeight] = useState(insets.top + 110);
  const [bottomHeight, setBottomHeight] = useState(300);

  const select = (id: string) => {
    if (!activeDay) return;
    setChoice({ day: activeDay.id, id, at: activeId });
    map.current?.focus(id);
  };

  const top = insets.top + 8;
  const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });
  const hopText = (index: number) => {
    const prev = index > 0 ? stops[index - 1] : null;
    if (!prev) return null;
    const hop = hopBetween(prev, stops[index]);
    return hop.walkMin !== null ? t('live.hopWalk', { min: hop.walkMin, km: numberFormat.format(hop.km) }) : t('live.hopFar', { km: numberFormat.format(hop.km) });
  };

  const ok = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  const go = (item: LiveStopRow) => {
    setStep(item.id, 'enroute');
    Haptics.selectionAsync().catch(() => undefined);
    // Başlangıç verilmez: rota ekranı konumundan başlar.
    openRoute(item, null, city, tripId);
  };
  const arrive = (item: LiveStopRow) => {
    setStep(item.id, 'here');
    Haptics.selectionAsync().catch(() => undefined);
  };
  const done = (item: LiveStopRow) => {
    mark(item.id, 'done');
    ok();
  };
  const skip = (item: LiveStopRow) => {
    mark(item.id, 'skipped');
    Haptics.selectionAsync().catch(() => undefined);
  };
  const undo = (item: LiveStopRow) => {
    mark(item.id, null);
    Haptics.selectionAsync().catch(() => undefined);
  };
  const finishDay = () => {
    markMany(remainingIds(stops, marks), 'skipped');
    if (freeKey) setDayFlag(freeKey, 'ended');
    setEndOpen(false);
    ok();
  };

  // Kalan günü konumdan yeniden düzenle (geç kaldın ya da yağmur var).
  const [rearranged, setRearranged] = useState<'ok' | 'fail' | null>(null);
  const rearrange = async (kind: 'now' | 'rain') => {
    setRearranged(null);
    const message =
      kind === 'rain'
        ? 'Rain is likely today. Swap the outdoor stops for good indoor alternatives nearby and rearrange the rest of today around where I am now. Keep locked bookings and flights exactly as they are.'
        : 'Rearrange the rest of today around where I am now. Keep locked bookings and flights exactly as they are.';
    try {
      await replan.mutateAsync({ message, tripId });
      setRearranged('ok');
    } catch {
      setRearranged('fail');
    }
  };

  const todayWeather = weather.data?.days.find((w) => w.date === today) ?? null;
  const rainy = isToday && canEdit && !freeDay && todayWeather?.rainChance != null && todayWeather.rainChance >= RAIN_WARN_PCT && activeStop?.is_indoor === false;
  // Sabah kartı yalnızca gün henüz başlamadıysa (ilk duraktan en fazla yarım saat sonrasına kadar) çıkar.
  const firstStart = stops[0]?.starts_at ? Date.parse(stops[0].starts_at) : NaN;
  const showStart = isToday && !freeDay && !dayFlag && !hasProgress && stops.length > 0 && (!Number.isFinite(firstStart) || nowMs < firstStart + 30 * 60_000);
  const showEnd = isToday && !freeDay && !ended && (allClosed || endOpen);
  const readOnlyActions = isToday && canEdit && !freeDay && !ended;
  const collapsedMax = Math.min(340, height * 0.42);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {stops.length > 0 && (
        <LiveMap
          ref={map}
          points={stops.map((s, i) => ({
            id: s.id,
            lat: s.lat,
            lng: s.lng,
            title: s.place_name ?? s.title,
            label: String(i + 1),
            locked: s.is_locked,
            status: statuses ? (statuses[i] === 'here' ? 'now' : statuses[i] === 'enroute' ? 'next' : statuses[i]) : undefined,
          }))}
          selectedId={selectedId}
          onSelect={(id) => select(id)}
          guide={guide}
          here={guidance.here}
          topInset={fullMap ? insets.top + 72 : topHeight}
          bottomInset={fullMap ? insets.bottom + 96 : bottomHeight}
        />
      )}

      {fullMap && (
        <View style={[styles.fullTop, { top }]} pointerEvents="box-none">
          <Tap accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} hitSlop={12} feedback="press">
            <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name="close" size={20} color={colors.text} />
            </View>
          </Tap>
        </View>
      )}
      <View style={[styles.top, { paddingTop: top }, fullMap && styles.hidden]} pointerEvents={fullMap ? 'none' : 'box-none'} onLayout={(e) => setTopHeight(e.nativeEvent.layout.height)}>
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
        </View>
        {days.length > 0 && <DaySelector days={days} selected={dayIndex} onSelect={setPickedDay} />}
      </View>

      {stops.length > 0 && (
        <View style={[styles.controls, { bottom: fullMap ? insets.bottom + Spacing.lg : bottomHeight + Spacing.sm }]} pointerEvents="box-none">
          {guidance.here && (
            <Tap accessibilityRole="button" accessibilityLabel={t('live.locate')} onPress={() => map.current?.locate()} feedback="select">
              <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="locate" size={20} color={colors.primary} />
              </View>
            </Tap>
          )}
          {stops.length > 1 && (
            <Tap accessibilityRole="button" accessibilityLabel={t('live.fitAll')} onPress={() => map.current?.fit()} feedback="select">
              <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Ionicons name="scan-outline" size={20} color={colors.text} />
              </View>
            </Tap>
          )}
          <Tap
            accessibilityRole="button"
            accessibilityLabel={fullMap ? t('live.exitFullMap') : t('live.fullMap')}
            onPress={() => {
              setFullMap((v) => !v);
              // Paneller kapanıp açılınca duraklar yeni boşluğa yeniden sığdırılır.
              setTimeout(() => map.current?.fit(), 350);
            }}
            feedback="select">
            <View style={[styles.round, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={fullMap ? 'contract-outline' : 'expand-outline'} size={20} color={colors.text} />
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
          <EmptyState icon="map-outline" title={hasPlans ? t('live.emptyTitle') : t('live.emptyNoPlanTitle')} description={hasPlans ? t('live.emptyBody') : t('live.emptyNoPlanBody')} />
        </View>
      ) : (
        <View
          style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border, paddingBottom: insets.bottom + Spacing.sm }, fullMap && styles.hidden]}
          pointerEvents={fullMap ? 'none' : 'auto'}
          onLayout={(e) => setBottomHeight(e.nativeEvent.layout.height)}>
          <Tap accessibilityRole="button" accessibilityLabel={expanded ? t('live.collapse') : t('live.expand')} onPress={() => setExpanded((v) => !v)} feedback="select" hitSlop={12}>
            <View style={styles.handleBox}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>
          </Tap>
          <ScrollView style={{ maxHeight: expanded ? height * 0.66 : collapsedMax }} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} nestedScrollEnabled>
            {isToday && (
              <View style={styles.progressRow}>
                <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: colors.success }]} />
                </View>
                <Text variant="caption" color="textMuted">
                  {t('live.strip.progress', { done: finished, total: stops.length })}
                </Text>
              </View>
            )}

            {freeDay && (
              <Card variant="solid" padding={Spacing.md}>
                <Text variant="caption" color="textSecondary">
                  {t('live.freeDayNote')}
                </Text>
              </Card>
            )}

            {isToday && ended ? (
              <DayEndedCard done={summary.done} skipped={summary.skipped} onJournal={() => router.push({ pathname: '/trip-journal', params: { tripId } })} onReopen={() => freeKey && setDayFlag(freeKey, null)} />
            ) : showEnd ? (
              <DayEndCard
                done={summary.done}
                skipped={summary.skipped}
                left={summary.left}
                onJournal={() => router.push({ pathname: '/trip-journal', params: { tripId } })}
                onExpense={() => router.push({ pathname: '/expenses', params: { tripId } })}
                onFinish={finishDay}
              />
            ) : showStart ? (
              <DayStartCard
                count={stops.length}
                first={stops[0] ?? null}
                weather={todayWeather}
                timezone={timezone}
                onStart={() => {
                  if (freeKey) setDayFlag(freeKey, 'started');
                  ok();
                }}
              />
            ) : (
              selected && (
                <LiveHero
                  stop={selected}
                  index={selectedIndex}
                  total={stops.length}
                  status={selectedStatus}
                  nowMs={nowMs}
                  timezone={selected.timezone ?? timezone}
                  etaMin={selected.id === activeId ? guidance.etaMin : null}
                  etaMode={guidance.etaMode}
                  leaveIn={selected.id === activeId ? guidance.leaveIn : null}
                  following={stops[selectedIndex + 1] ?? null}
                  actions={readOnlyActions}
                  onGo={() => go(selected)}
                  onArrive={() => arrive(selected)}
                  onDone={() => done(selected)}
                  onUndo={() => undo(selected)}
                  onSkip={() => skip(selected)}
                  onDirections={() => openRoute(selected, selectedIndex > 0 ? stops[selectedIndex - 1] : null, city, tripId)}
                  onDetails={
                    selected.google_place_id
                      ? () => openPlaceCard({ id: selected.google_place_id!, name: selected.place_name ?? selected.title, address: selected.address, lat: selected.lat, lng: selected.lng, mapsUrl: selected.maps_url })
                      : undefined
                  }
                />
              )
            )}

            {isToday && !freeDay && !ended && <GuidancePanel tripId={tripId} guidance={guidance} timezone={timezone} nowMs={nowMs} canEdit={canEdit} />}

            {rainy && (
              <Card variant="solid" padding={Spacing.md}>
                <View style={styles.row}>
                  <Ionicons name="rainy" size={22} color={colors.accent} />
                  <View style={styles.flex}>
                    <Text variant="bodyStrong">{t('live.rain.title', { pct: Math.round(todayWeather?.rainChance ?? 0) })}</Text>
                    <Text variant="caption" color="textSecondary">
                      {t('live.rain.body', { title: activeStop?.title ?? '' })}
                    </Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Chip icon="umbrella-outline" label={replan.isPending ? t('common.loading') : t('live.rain.action')} onPress={() => (replan.isPending ? undefined : rearrange('rain'))} />
                </View>
              </Card>
            )}
            {rearranged && (
              <Text variant="caption" color={rearranged === 'ok' ? 'success' : 'danger'}>
                {rearranged === 'ok' ? t('live.guidance.rearranged') : t('live.guidance.rearrangeFailed')}
              </Text>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quick}>
              {isToday && <Chip icon="cafe-outline" label={t('live.nearby')} onPress={() => router.dismissTo('/explore')} />}
              <Chip icon="wallet-outline" label={t('live.quick.expense')} onPress={() => router.push({ pathname: '/expenses', params: { tripId } })} />
              <Chip icon="camera-outline" label={t('live.quick.journal')} onPress={() => router.push({ pathname: '/trip-journal', params: { tripId } })} />
              {isToday && canEdit && !freeDay && <Chip icon="shuffle-outline" label={replan.isPending ? t('common.loading') : t('live.quick.rearrange')} onPress={() => (replan.isPending ? undefined : rearrange('now'))} />}
              {freeKey && <Chip icon={freeDay ? 'checkmark-circle' : 'sunny-outline'} label={isToday ? t('live.freeDay') : t('live.freeDayThis')} selected={freeDay} onPress={() => setFreeDay(freeKey, !freeDay)} />}
            </ScrollView>

            <Text variant="overline" color="textMuted" style={styles.sectionTitle}>
              {t('live.timelineTitle')}
            </Text>
            <LiveTimeline stops={stops} statuses={statuses} selectedId={selectedId} hop={hopText} onSelect={select} />

            {isToday && !freeDay && !ended && !showEnd && stops.length > 0 && (
              <Chip icon="moon-outline" label={t('live.day.finishEarly')} onPress={() => setEndOpen(true)} />
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  hidden: { opacity: 0 },
  fullTop: { position: 'absolute', left: Spacing.lg, zIndex: 5 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, gap: Spacing.sm, paddingBottom: Spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg },
  round: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  pad: { padding: Spacing.xl },
  controls: { position: 'absolute', right: Spacing.lg, gap: Spacing.sm },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1, borderBottomWidth: 0 },
  handleBox: { alignItems: 'center', paddingVertical: Spacing.sm },
  handle: { width: 40, height: 5, borderRadius: 3 },
  content: { gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  quick: { flexDirection: 'row', gap: Spacing.sm, paddingRight: Spacing.lg },
  sectionTitle: { marginTop: Spacing.xs },
});
