import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RESERVATION_ICONS, TRANSPORT_TYPES } from '@/features/documents/reservation-icons';
import { GenerateCard } from '@/features/plan/generate-card';
import { DaySelector, DayTimeline } from '@/features/plan/plan-timeline';
import {
  GenerateError,
  useActivePlan,
  useGenerateItinerary,
  useTrip,
  type TripReservation,
} from '@/features/trips/queries';
import { daysUntil, formatDateRange, formatLocalDateTime, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

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
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [showReservations, setShowReservations] = useState(false);

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

  const days = plan?.day_plans ?? [];
  const dayIndex = Math.min(selectedDay ?? initialDayIndex(days.map((d) => d.date)), Math.max(days.length - 1, 0));
  const totalDays = trip.start_date && trip.end_date ? daysUntil(trip.end_date, new Date(`${trip.start_date}T12:00:00`)) + 1 : 0;
  const truncatedTo = plan && days.length < totalDays ? days.length : null;
  const generateError =
    generate.error instanceof GenerateError ? t(`plan.errors.${generate.error.code}`) : generate.error ? t('plan.errors.network') : null;

  return (
    <Screen
      footer={
        <Button
          title={t('trip.addDocument')}
          variant="secondary"
          onPress={() => router.push({ pathname: '/ticket', params: { tripId: trip.id } })}
        />
      }>
      <ModalHeader title={trip.title} subtitle={formatDateRange(trip.start_date, trip.end_date)} />

      <View style={styles.actions}>
        <Button
          title={t('trip.changeDates')}
          variant="secondary"
          style={styles.flex}
          onPress={() => router.push({ pathname: '/trip-dates', params: { tripId: trip.id } })}
        />
        {plan && (
          <Button
            title={t('trip.versions')}
            variant="secondary"
            style={styles.flex}
            onPress={() => router.push({ pathname: '/trip-versions', params: { tripId: trip.id } })}
          />
        )}
      </View>

      {trip.trip_destinations.length > 0 && (
        <View style={styles.chips}>
          {trip.trip_destinations.map((d) => (
            <Chip key={d.id} icon="location-outline" label={`${d.city} · ${formatDateRange(d.arrive_on, d.depart_on)}`} />
          ))}
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
        ) : !plan || generate.isPending ? (
          <GenerateCard pending={generate.isPending} error={generateError} onGenerate={() => generate.mutate()} />
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
              </View>
            )}
            <DaySelector days={days} selected={dayIndex} onSelect={setSelectedDay} />
            {days[dayIndex] && <DayTimeline day={days[dayIndex]} />}
            {generateError && (
              <Text variant="caption" color="danger">
                {generateError}
              </Text>
            )}
            <Button title={t('plan.regenerate')} variant="ghost" onPress={() => generate.mutate()} />
          </>
        )}
      </View>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: Spacing.xxs },
});
