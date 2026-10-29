import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { RESERVATION_ICONS, TRANSPORT_TYPES } from '@/features/documents/reservation-icons';
import { formatLocalDateTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { TripReservation } from './queries';

/** Bir rezervasyonun (uçuş, otel, tren…) tek satırı: saat, başlık, güzergah ve rezervasyon kodu. */
export function ReservationRow({ reservation: r }: { reservation: TripReservation }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const transport = TRANSPORT_TYPES.includes(r.type);
  const route = transport ? [r.origin_code ?? r.origin_name, r.destination_code ?? r.destination_name].filter(Boolean).join(' → ') : r.address;

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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: Spacing.xxs },
});
