import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RESERVATION_ICONS, TRANSPORT_TYPES } from '@/features/documents/reservation-icons';
import { useTrip, type TripReservation } from '@/features/trips/queries';
import { formatDateRange, formatLocalDateTime } from '@/lib/format';
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

/**
 * Seyahat detayı: duraklar ve rezervasyonlar. Gün gün rota ve harita 5. adımda
 * bu ekrana eklenecek.
 */
export default function TripScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading, isError } = useTrip(id);

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

      {trip.trip_destinations.length > 0 && (
        <View style={styles.section}>
          <Text variant="subtitle">{t('trip.destinations')}</Text>
          <View style={styles.chips}>
            {trip.trip_destinations.map((d) => (
              <Chip key={d.id} icon="location-outline" label={`${d.city} · ${formatDateRange(d.arrive_on, d.depart_on)}`} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="subtitle">{t('trip.reservations')}</Text>
        {trip.reservations.map((r) => (
          <ReservationRow key={r.id} reservation={r} />
        ))}
      </View>

      <Text variant="caption" color="textMuted" style={styles.center}>
        {t('trip.planSoon')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: Spacing.xxs },
  center: { textAlign: 'center' },
});
