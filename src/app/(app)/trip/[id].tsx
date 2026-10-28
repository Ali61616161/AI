import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DirIcon } from '@/components/ui/dir-icon';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RESERVATION_ICONS, TRANSPORT_TYPES } from '@/features/documents/reservation-icons';
import { PlacesMap } from '@/features/map/places-map';
import { OfflineCard } from '@/features/offline/offline-card';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { TripTools } from '@/features/tools/trip-tools';
import { TripHero } from '@/features/trips/trip-hero';
import { useTripWeather } from '@/features/places/api';
import { GenerateCard } from '@/features/plan/generate-card';
import { DaySelector, DayTimeline } from '@/features/plan/plan-timeline';
import {
  GenerateError,
  useActivePlan,
  useGenerateItinerary,
  useDeleteTrip,
  useLeaveTrip,
  useTrip,
  type TripReservation,
} from '@/features/trips/queries';
import { daysUntil, formatDateRange, formatDayShort, formatLocalDateTime, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { ShareSection } from '@/features/sharing/share-section';
import { useSessionStore } from '@/stores/session-store';
import { NativeAdCard } from '@/features/ads/native-ad-card';
import { EsimCard } from '@/features/esim/esim-card';
import { FlightStatusCard } from '@/features/travel/flight-status-card';

function ReservationRow({ reservation: r }: { reservation: TripReservation }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const transport = TRANSPORT_TYPES.includes(r.type);
  const route = transport
    ? [r.origin_code ?? r.origin_name, r.destination_code ?? r.destination_name].filter(Boolean).join(' → ')
    : r.address;

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name={RESERVATION_ICONS[r.type]} size={20} color={colors.primary} />
      </View>
      <View style={styles.rowText}>
        <Text variant="caption" color="textMuted">
          {formatLocalDateTime(r.starts_at, r.start_timezone)}
          {r.ends_at ? ` – ${formatLocalDateTime(r.ends_at, r.end_timezone ?? r.start_timezone)}` : ''}
        </Text>
        <Text variant="bodyStrong">{r.title}</Text>
        {route ? (
          <Text variant="caption" color="textSecondary">
            {route}
          </Text>
        ) : null}
        {r.reference_code && (
          <Text variant="caption" color="textSecondary">
            {t('trip.reference', { code: r.reference_code })}
          </Text>
        )}
      </View>
    </View>
  );
}

/** Seyahatin bugüne denk gelen gününü (yoksa ilk günü) seçer. */
function initialDayIndex(dates: string[]): number {
  const index = dates.indexOf(todayIsoDate());
  return index >= 0 ? index : 0;
}

/** Seyahat detayı: gün gün rota, duraklar ve rezervasyonlar. */
export default function TripScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);
  const { data: plan, isLoading: planLoading } = useActivePlan(id);
  const generate = useGenerateItinerary(id);
  const deleteTrip = useDeleteTrip();
  const leaveTrip = useLeaveTrip();
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showReservations, setShowReservations] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const weather = useTripWeather(id);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (isError || !trip) {
    return (
      <Screen>
        <ModalHeader title={t('trips.title')} />
        <EmptyState icon="alert-circle-outline" title={t('trip.notFound')} description={t('trips.loadFailed')} />
      </Screen>
    );
  }

  // Başkasının paylaştığı seyahat: yalnızca görüntülenir.
  const readOnly = trip.owner_id !== userId;
  const days = plan?.day_plans ?? [];
  const dayIndex = Math.min(selectedDay ?? initialDayIndex(days.map((d) => d.date)), Math.max(days.length - 1, 0));
  const totalDays = trip.start_date && trip.end_date ? daysUntil(trip.end_date, new Date(`${trip.start_date}T12:00:00`)) + 1 : 0;
  const truncatedTo = plan && days.length < totalDays ? days.length : null;
  const day = days[dayIndex];
  const dayWeather = day ? weather.data?.days.find((w) => w.date === day.date) : undefined;
  const mapPoints = (day?.plan_items ?? [])
    .filter((i) => i.lat !== null && i.lng !== null)
    .map((i, n) => ({ id: i.id, lat: i.lat!, lng: i.lng!, title: i.place_name ?? i.title, label: String(n + 1), locked: i.is_locked }));
  const generateError =
    generate.error instanceof GenerateError ? t(`plan.errors.${generate.error.code}`) : generate.error ? t('plan.errors.network') : null;

  return (
    <Screen
      footer={
        readOnly ? undefined : (
          <Button
            title={t('trip.addDocument')}
            variant="secondary"
            onPress={() => router.push({ pathname: '/ticket', params: { tripId: trip.id } })}
          />
        )
      }>
      <TripHero
        id={trip.id}
        city={trip.trip_destinations[0]?.city ?? trip.title}
        title={trip.title}
        subtitle={formatDateRange(trip.start_date, trip.end_date)}
        actions={
          readOnly
            ? []
            : [
                { icon: 'calendar-outline', label: t('trip.changeDates'), onPress: () => router.push({ pathname: '/trip-dates', params: { tripId: trip.id } }) },
                ...(plan ? [{ icon: 'git-branch-outline' as const, label: t('trip.versions'), onPress: () => router.push({ pathname: '/trip-versions', params: { tripId: trip.id } }) }] : []),
                { icon: 'bed-outline', label: t('hotels.button'), onPress: () => router.push({ pathname: '/hotels', params: { tripId: trip.id } }) },
              ]
        }
      />

      {readOnly && (
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="eye-outline" size={18} color={colors.primary} />
          <Text variant="caption" style={styles.flex}>
            {t('share.viewerBanner')}
          </Text>
        </View>
      )}

      {/* Seyahat merkezi: canlı görünüm, cüzdan ve acil durum tek dokunuşla. */}
      <View style={styles.hub}>
        {[
          ...(plan && (day?.plan_items ?? []).some((i) => i.lat !== null) ? [{ key: 'live', icon: 'navigate-circle' as const, label: t('live.open'), onPress: () => router.push({ pathname: '/trip-live', params: { tripId: trip.id, day: String(dayIndex) } }) }] : []),
          { key: 'wallet', icon: 'wallet' as const, label: t('wallet.title'), onPress: () => router.push({ pathname: '/wallet', params: { tripId: trip.id } }) },
          { key: 'sos', icon: 'medkit' as const, label: t('today.quick.sos'), onPress: () => router.push({ pathname: '/sos', params: { tripId: trip.id } }) },
        ].map((x) => (
          <Pressable key={x.key} accessibilityRole="button" accessibilityLabel={x.label} onPress={x.onPress} style={[styles.hubTile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name={x.icon} size={26} color={x.key === 'sos' ? colors.danger : colors.primary} />
            <Text variant="caption" numberOfLines={1} style={styles.hubText}>
              {x.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {trip.trip_destinations.length > 1 && (
        <View style={styles.chips}>
          {trip.trip_destinations.map((d) => (
            <Chip key={d.id} icon="location-outline" label={`${d.city} · ${formatDateRange(d.arrive_on, d.depart_on)}`} />
          ))}
          {/* Şehirler arası geçiş: güzergah ve tren/otobüs/feribot/uçak bileti. */}
          {trip.trip_destinations.slice(1).map((d, i) => {
            const prev = trip.trip_destinations[i];
            const place = (x: typeof d) => (x.country_code ? `${x.city}, ${x.country_code}` : x.city);
            return (
              <Chip
                key={`route-${d.id}`}
                icon="git-branch-outline"
                label={t('route.between', { from: prev.city, to: d.city })}
                onPress={() =>
                  router.push({
                    pathname: '/route',
                    params: {
                      fromAddress: place(prev),
                      fromName: prev.city,
                      toAddress: place(d),
                      toName: d.city,
                      country: prev.country_code ?? '',
                      ...(prev.depart_on ? { departAt: `${prev.depart_on}T08:00:00Z` } : {}),
                    },
                  })
                }
              />
            );
          })}
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text variant="title">{t('plan.title')}</Text>
          {plan && (
            <Text variant="caption" color="textMuted">
              {t('plan.version', { version: plan.version })}
            </Text>
          )}
        </View>

        {planLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : !plan && readOnly ? (
          <Text variant="body" color="textSecondary">
            {t('share.noPlan')}
          </Text>
        ) : !plan || generate.isPending ? (
          <GenerateCard pending={generate.isPending} error={generateError} onGenerate={(options) => generate.mutate(options)} />
        ) : (
          <>
            {plan.summary && (
              <Text variant="body" color="textSecondary">
                {plan.summary}
              </Text>
            )}
            {truncatedTo !== null && (
              <View style={[styles.notice, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.primary} />
                <Text variant="caption" style={styles.flex}>
                  {t('plan.truncated', { count: truncatedTo })}
                </Text>
                <UpgradeButton tripId={trip.id} />
              </View>
            )}
            <DaySelector days={days} selected={dayIndex} onSelect={setSelectedDay} />
            {weather.data?.available_from && (
              <Text variant="caption" color="textMuted">
                {t('weather.availableFrom', { date: formatDayShort(weather.data.available_from) })}
              </Text>
            )}
            {mapPoints.length > 0 && (
              <View style={styles.mapBlock}>
                <Pressable accessibilityRole="button" accessibilityState={{ expanded: showMap }} onPress={() => setShowMap((v) => !v)} style={styles.mapToggle}>
                  <Ionicons name="map-outline" size={16} color={colors.primary} />
                  <Text variant="caption" style={{ color: colors.primary }}>
                    {showMap ? t('map.hideMap') : t('map.showMap')}
                  </Text>
                </Pressable>
                {showMap && <PlacesMap key={day?.id} points={mapPoints} />}
              </View>
            )}
            {day && <DayTimeline day={day} weather={dayWeather} tripId={trip.id} budget={trip.budget_amount && trip.budget_currency ? { amount: trip.budget_amount, currency: trip.budget_currency } : null} />}
            {generateError && (
              <Text variant="caption" color="danger">
                {generateError}
              </Text>
            )}
            {!readOnly && <Button title={t('plan.regenerate')} variant="ghost" onPress={() => generate.mutate()} />}
          </>
        )}
      </View>

      {trip.start_date && trip.start_date <= todayIsoDate() && (
        <Card variant="glow" onPress={() => router.push({ pathname: '/trip-report', params: { tripId: trip.id } })} accessibilityLabel={t('report.ctaBody')}>
          <View style={styles.reportRow}>
            <IconBadge icon="trophy" tone="gradient" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{trip.end_date && trip.end_date < todayIsoDate() ? t('report.cta') : t('report.ctaDuring')}</Text>
              <Text variant="caption" color="textSecondary">
                {t('report.ctaBody')}
              </Text>
            </View>
            <DirIcon name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </Card>
      )}

      {trip.start_date && trip.start_date <= todayIsoDate() && (
        <Card onPress={() => router.push({ pathname: '/trip-journal', params: { tripId: trip.id } })} accessibilityLabel={t('journal.cardBody')}>
          <View style={styles.reportRow}>
            <IconBadge icon="book" />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('journal.card')}</Text>
              <Text variant="caption" color="textSecondary">
                {t('journal.cardBody')}
              </Text>
            </View>
            <DirIcon name="chevron-forward" size={18} color={colors.textSecondary} />
          </View>
        </Card>
      )}

      <FlightStatusCard tripId={trip.id} reservations={trip.reservations} />

      <EsimCard countryCodes={trip.trip_destinations.map((d) => d.country_code)} />

      <TripTools tripId={trip.id} />

      <NativeAdCard />

      <OfflineCard tripId={trip.id} countryCode={trip.trip_destinations[0]?.country_code ?? null} />

      {trip.reservations.length > 0 && (
        <View style={styles.section}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showReservations }}
            onPress={() => setShowReservations((v) => !v)}
            style={styles.sectionHeader}>
            <Text variant="subtitle">
              {t('plan.showReservations')} · {trip.reservations.length}
            </Text>
            <Ionicons name={showReservations ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
          </Pressable>
          {showReservations && trip.reservations.map((r) => <ReservationRow key={r.id} reservation={r} />)}
        </View>
      )}
      {!readOnly && <ShareSection tripId={trip.id} tripTitle={trip.title} />}
      {readOnly ? (
        <Button
          title={t('share.leave')}
          variant="ghost"
          loading={leaveTrip.isPending}
          onPress={() =>
            Alert.alert(t('share.leave'), t('share.leaveBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('share.leave'), style: 'destructive', onPress: () => leaveTrip.mutate(trip.id, { onSuccess: () => router.replace('/trips') }) },
            ])
          }
        />
      ) : (
      <Button
        title={t('trip.delete')}
        variant="ghost"
        loading={deleteTrip.isPending}
        onPress={() =>
          Alert.alert(t('trip.deleteTitle', { title: trip.title }), t('trip.deleteBody'), [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('trip.delete'), style: 'destructive', onPress: () => deleteTrip.mutate(trip.id, { onSuccess: () => router.replace('/trips') }) },
          ])
        }
      />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hub: { flexDirection: 'row', gap: Spacing.sm },
  hubTile: { flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xs, borderRadius: Radius.lg, borderWidth: 1 },
  hubText: { textAlign: 'center' },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  flex: { flex: 1 },
  mapBlock: { gap: Spacing.sm },
  mapToggle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: Spacing.xxs },
});
