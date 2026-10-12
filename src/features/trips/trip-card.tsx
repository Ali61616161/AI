import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { daysUntil, formatDateRange, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CityArt, paletteFor } from './city-art';
import type { TripListItem } from './queries';

/** Seyahat başladıysa kaçıncı günde olunduğu; başlamadıysa null. */
function tripProgress(start: string | null, end: string | null, today: string) {
  if (!start || !end || start > today || end < today) return null;
  const total = daysUntil(end, new Date(`${start}T12:00:00`)) + 1;
  const day = daysUntil(today, new Date(`${start}T12:00:00`)) + 1;
  return { day: Math.min(Math.max(day, 1), total), total: Math.max(total, 1) };
}

export function TripCard({ trip, highlight = false }: { trip: TripListItem; highlight?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = todayIsoDate();
  const city = trip.trip_destinations[0]?.city ?? trip.title;
  const progress = tripProgress(trip.start_date, trip.end_date, today);
  const countdown = trip.start_date && trip.start_date > today ? daysUntil(trip.start_date) : null;
  const open = () => router.push({ pathname: '/trip/[id]', params: { id: trip.id } });

  let badge: string | null = null;
  if (countdown !== null) badge = t('trips.daysLeft', { count: countdown });
  else if (trip.start_date === today) badge = t('trips.startsToday');
  else if (progress) badge = t('trips.ongoing');

  if (highlight) {
    return (
      <Tap accessibilityRole="button" accessibilityLabel={trip.title} onPress={open} scaleTo={0.98} style={styles.heroShadow}>
        <View style={styles.hero}>
          <CityArt seed={city} id={trip.id} />
          <View style={styles.heroTop}>
            {badge && (
              <View style={styles.glassPill}>
                <View style={[styles.dot, { backgroundColor: progress ? '#7CFFB2' : '#FFFFFF' }]} />
                <Text variant="caption" style={styles.onArt}>
                  {badge}
                </Text>
              </View>
            )}
            <View style={styles.arrow}>
              <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.heroBottom}>
            <Text variant="hero" numberOfLines={1} adjustsFontSizeToFit style={styles.onArt}>
              {trip.title}
            </Text>
            <View style={styles.heroMeta}>
              <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text variant="caption" style={styles.onArtSoft}>
                {formatDateRange(trip.start_date, trip.end_date)}
              </Text>
              <Text variant="caption" style={styles.onArtSoft}>
                ·
              </Text>
              <Ionicons name="ticket-outline" size={14} color="rgba(255,255,255,0.85)" />
              <Text variant="caption" style={styles.onArtSoft}>
                {t('trips.reservationCount', { count: trip.reservation_count })}
              </Text>
            </View>
            {progress && (
              <View style={styles.progressWrap} accessibilityLabel={t('trips.dayProgress', progress)}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${(progress.day / progress.total) * 100}%` }]} />
                </View>
                <Text variant="caption" style={styles.onArt}>
                  {t('trips.dayProgress', progress)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Tap>
    );
  }

  const p = paletteFor(city.toLowerCase());
  return (
    <Tap accessibilityRole="button" accessibilityLabel={trip.title} onPress={open} scaleTo={0.985}>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <LinearGradient colors={[p.from, p.to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.thumb}>
          <Text variant="subtitle" style={styles.onArt}>
            {city.slice(0, 2).toLocaleUpperCase()}
          </Text>
        </LinearGradient>
        <View style={styles.rowText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {trip.title}
          </Text>
          <Text variant="caption" color="textSecondary">
            {formatDateRange(trip.start_date, trip.end_date)}
          </Text>
          <View style={styles.rowMeta}>
            {badge && (
              <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
                <Text variant="caption">{badge}</Text>
              </View>
            )}
            <Text variant="caption" color="textMuted">
              {t('trips.reservationCount', { count: trip.reservation_count })}
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  heroShadow: { borderRadius: Radius.xl, shadowColor: '#FF3D7F', shadowOpacity: 0.3, shadowRadius: 24, shadowOffset: { width: 0, height: 12 }, elevation: 8 },
  hero: { height: 228, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, justifyContent: 'space-between' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heroBottom: { gap: Spacing.sm },
  heroMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, flexWrap: 'wrap' },
  glassPill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.22)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  dot: { width: 7, height: 7, borderRadius: 4 },
  arrow: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  onArt: { color: '#FFFFFF' },
  onArtSoft: { color: 'rgba(255,255,255,0.85)' },
  progressWrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xs },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.25)', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3, backgroundColor: '#FFFFFF' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  thumb: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 3 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginTop: 2 },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
});
