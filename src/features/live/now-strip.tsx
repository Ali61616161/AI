import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import type { DayForecast } from '@/features/places/api';
import { weatherIcon } from '@/features/places/weather-badge';
import { formatTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { LATE_WARN_MIN } from './drift-logic';
import type { useLiveGuidance } from './use-live-guidance';

type Guidance = ReturnType<typeof useLiveGuidance>;

const MODE_ICON = { walk: 'walk', transit: 'bus', drive: 'car' } as const;

/**
 * Canlı görünümün üst şeridi (yalnızca bugün): günün ilerlemesi, sıradaki durak ve ne zaman yola
 * çıkman gerektiği, bugünün havası. Hepsi tek bakışta.
 */
export function NowStrip({ guidance, progress, weather, timezone }: { guidance: Guidance; progress: { done: number; total: number; ratio: number }; weather: DayForecast | null; timezone: string | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { upcoming, etaMin, etaMode, leaveIn, freeDay } = guidance;
  const allDone = progress.total > 0 && progress.done >= progress.total;

  // Çıkış durumu: geç kalma uyarısı GuidancePanel'de; burada "x dk içinde çık / şimdi çık".
  let leave: { text: string; tone: string } | null = null;
  if (upcoming && leaveIn !== null && leaveIn > -LATE_WARN_MIN) {
    leave = leaveIn > 1 ? { text: t('live.strip.leaveIn', { min: leaveIn }), tone: leaveIn <= 10 ? colors.warning : colors.success } : { text: t('live.strip.leaveNow'), tone: colors.warning };
  }

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          {freeDay ? (
            <Text variant="bodyStrong">{t('live.strip.freeDay')}</Text>
          ) : allDone ? (
            <Text variant="bodyStrong">{t('live.strip.dayDone')}</Text>
          ) : upcoming ? (
            <>
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {t('live.strip.next', { time: upcoming.starts_at ? formatTime(upcoming.starts_at, timezone) : '' })}
              </Text>
              <Text variant="bodyStrong" numberOfLines={1}>
                {upcoming.title}
              </Text>
            </>
          ) : (
            <Text variant="bodyStrong">{t('live.strip.noMore')}</Text>
          )}
        </View>
        {weather && (weather.max !== null || weather.condition) && (
          <View style={styles.weather} accessible accessibilityLabel={[weather.description, weather.max !== null ? `${Math.round(weather.max)}°` : null].filter(Boolean).join(', ')}>
            <Ionicons name={weatherIcon(weather.condition)} size={18} color={weather.rainChance !== null && weather.rainChance >= 30 ? colors.accent : colors.warning} />
            {weather.max !== null && <Text variant="bodyStrong">{Math.round(weather.max)}°</Text>}
          </View>
        )}
      </View>

      {upcoming && !freeDay && (etaMin !== null || leave) && (
        <View style={styles.row}>
          {etaMin !== null && (
            <View style={styles.chip}>
              <Ionicons name={MODE_ICON[etaMode]} size={14} color={colors.textSecondary} />
              <Text variant="caption" color="textSecondary">
                {t('live.strip.eta', { min: etaMin })}
              </Text>
            </View>
          )}
          {leave && (
            <View style={[styles.pill, { backgroundColor: leave.tone }]}>
              <Ionicons name="time-outline" size={13} color="#FFFFFF" />
              <Text variant="caption" style={styles.pillText}>
                {leave.text}
              </Text>
            </View>
          )}
        </View>
      )}

      {progress.total > 0 && (
        <View style={styles.progressRow}>
          <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
            <View style={[styles.fill, { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: colors.success }]} />
          </View>
          <Text variant="caption" color="textMuted">
            {t('live.strip.progress', { done: progress.done, total: progress.total })}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginHorizontal: Spacing.lg, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  pillText: { color: '#FFFFFF', fontWeight: '700' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 2 },
  track: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
