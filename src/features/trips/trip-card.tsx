import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { daysUntil, formatDateRange, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { TripListItem } from './queries';

export function TripCard({ trip, highlight = false }: { trip: TripListItem; highlight?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = todayIsoDate();

  let badge: string | null = null;
  if (trip.start_date && trip.start_date > today) badge = t('trips.daysLeft', { count: daysUntil(trip.start_date) });
  else if (trip.start_date === today) badge = t('trips.startsToday');
  else if (trip.end_date && trip.end_date >= today) badge = t('trips.ongoing');

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/trip/[id]', params: { id: trip.id } })}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: highlight ? colors.primary : colors.surface,
          borderColor: highlight ? colors.primary : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}>
      <View style={styles.top}>
        <Text variant="subtitle" style={[styles.title, highlight && { color: colors.onPrimary }]} numberOfLines={2}>
          {trip.title}
        </Text>
        <Ionicons name="chevron-forward" size={20} color={highlight ? colors.onPrimary : colors.textMuted} />
      </View>
      <Text variant="body" style={{ color: highlight ? colors.onPrimary : colors.textSecondary }}>
        {formatDateRange(trip.start_date, trip.end_date)}
      </Text>
      <View style={styles.meta}>
        {badge && (
          <View style={[styles.badge, { backgroundColor: highlight ? 'rgba(255,255,255,0.22)' : colors.surfaceMuted }]}>
            <Text variant="caption" style={{ color: highlight ? colors.onPrimary : colors.text }}>
              {badge}
            </Text>
          </View>
        )}
        <Text variant="caption" style={{ color: highlight ? colors.onPrimary : colors.textMuted }}>
          {t('trips.reservationCount', { count: trip.reservation_count })}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  title: { flex: 1 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flexWrap: 'wrap' },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xxs, borderRadius: Radius.pill },
});
