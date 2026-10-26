import Ionicons from '@expo/vector-icons/Ionicons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/format';
import type { TripReservation } from '@/features/trips/queries';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useFlightAlerts, useFlightStatus, type FlightInfo } from './flight-status';

/**
 * Yaklaşan uçuşların canlı durumu: gecikme, iptal, terminal, kapı, bagaj bandı. Uçuş yoksa, kalkışa 24 saatten
 * fazla varsa ya da sunucuda servis anahtarı tanımlı değilse hiçbir şey göstermez.
 */
export function FlightStatusCard({ tripId, reservations }: { tripId: string; reservations: TripReservation[] }) {
  const { colors } = useTheme();
  const flights = useMemo(() => reservations.filter((r) => r.type === 'flight'), [reservations]);
  const timezones = useMemo(() => Object.fromEntries(flights.map((r) => [r.id, r.start_timezone])), [flights]);
  const query = useFlightStatus(tripId, flights.length > 0);
  useFlightAlerts(query.data, timezones);
  if (!query.data?.length) return null;

  return (
    <View style={styles.wrap}>
      {query.data.map((f) => (
        <Row key={f.reservation_id} flight={f} timezone={timezones[f.reservation_id] ?? null} colors={colors} />
      ))}
    </View>
  );
}

function Row({ flight: f, timezone, colors }: { flight: FlightInfo; timezone: string | null; colors: ReturnType<typeof useTheme>['colors'] }) {
  const { t } = useTranslation();
  const s = f.status;
  const bad = f.alert === 'canceled';
  const late = f.alert === 'delay';
  const tone = bad ? colors.danger : late ? colors.warning : colors.success;
  const title = bad
    ? t('flightStatus.canceled', { number: f.flight_number })
    : late
      ? t('flightStatus.delayed', { number: f.flight_number, min: s.departure.delay_min })
      : s.state === 'departed'
        ? t('flightStatus.departed', { number: f.flight_number })
        : s.state === 'arrived'
          ? t('flightStatus.arrived', { number: f.flight_number })
          : t('flightStatus.onTime', { number: f.flight_number });
  const details = [
    late && s.departure.revised_utc ? t('flightStatus.newDeparture', { time: formatTime(s.departure.revised_utc, timezone) }) : null,
    s.departure.terminal ? t('flightStatus.terminal', { terminal: s.departure.terminal }) : null,
    s.departure.gate ? t('flightStatus.gate', { gate: s.departure.gate }) : null,
    s.state === 'arrived' && s.arrival.baggage_belt ? t('flightStatus.baggage', { belt: s.arrival.baggage_belt }) : null,
  ].filter(Boolean);

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: tone }]} accessible accessibilityLabel={[title, ...details].join('. ')}>
      <Ionicons name={bad ? 'close-circle' : late ? 'time' : 'airplane'} size={22} color={tone} />
      <View style={styles.text}>
        <Text variant="bodyStrong">{title}</Text>
        {details.length > 0 && (
          <Text variant="caption" color="textSecondary">
            {details.join(' · ')}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  text: { flex: 1, gap: 2 },
});
