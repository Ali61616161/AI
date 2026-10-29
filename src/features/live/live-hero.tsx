import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { PlaceMeta } from '@/features/places/place-row';
import type { PlanItemRow } from '@/features/trips/queries';
import { formatTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { minutesLeft, minutesTo, type FlowStatus } from './live-flow';
import { durationText } from './live-text';

export type LiveStopRow = PlanItemRow & { lat: number; lng: number };

const MODE_ICON = { walk: 'walk', transit: 'bus', drive: 'car' } as const;

type Props = {
  stop: LiveStopRow;
  index: number;
  total: number;
  status: FlowStatus;
  nowMs: number;
  timezone: string | null;
  /** Konumundan bu durağa yol süresi (dk) ve türü. */
  etaMin: number | null;
  etaMode: 'walk' | 'transit' | 'drive';
  /** Yola çıkmana kalan dakika (negatif: geç). */
  leaveIn: number | null;
  /** Bu duraktan sonraki durak. */
  following: LiveStopRow | null;
  /** Yalnızca bugünün planında ve düzenleyebilen kullanıcıda düğmeler görünür. */
  actions: boolean;
  onGo: () => void;
  onArrive: () => void;
  onDone: () => void;
  onUndo: () => void;
  onSkip: () => void;
  onDirections: () => void;
  onDetails?: () => void;
};

/**
 * Canlı görünümün tek odağı: şu an ya da sıradaki durak. Büyük tek düğme günü ilerletir:
 * yola çık → vardım → bitirdim; sıradaki durak otomatik odak olur.
 */
export function LiveHero({ stop, index, total, status, nowMs, timezone, etaMin, etaMode, leaveIn, following, actions, onGo, onArrive, onDone, onUndo, onSkip, onDirections, onDetails }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tone = status === 'here' || status === 'now' ? colors.success : status === 'done' || status === 'skipped' || status === 'past' ? colors.textMuted : colors.primary;
  const start = stop.starts_at ? formatTime(stop.starts_at, timezone) : null;
  const end = stop.ends_at ? formatTime(stop.ends_at, timezone) : null;
  const untilStart = minutesTo(stop.starts_at, nowMs);
  const left = minutesLeft(stop, nowMs);

  // Zaman satırı: başlamasına kalan, başladı, bitmesine kalan.
  let when: string | null = null;
  if (status === 'now' || status === 'here') when = left !== null && left > 0 ? t('live.hero.endsIn', { dur: durationText(t, left) }) : null;
  else if (status === 'next' || status === 'enroute' || status === 'later') {
    if (untilStart !== null && untilStart > 0) when = t('live.hero.startsIn', { dur: durationText(t, untilStart) });
    else if (untilStart !== null) when = t('live.hero.startedAgo', { dur: durationText(t, -untilStart) });
  }
  const leave = leaveIn !== null && untilStart !== null && untilStart > 0 && status !== 'here' ? leaveIn : null;
  const leaveTone = leave !== null && leave <= 10 ? colors.warning : colors.success;

  const primary =
    status === 'here'
      ? { title: t('live.act.done'), icon: 'checkmark-circle' as const, onPress: onDone }
      : status === 'enroute'
        ? { title: t('live.act.arrive'), icon: 'location' as const, onPress: onArrive }
        : status === 'done' || status === 'skipped'
          ? { title: t('live.act.undo'), icon: 'arrow-undo' as const, onPress: onUndo }
          : { title: t('live.act.go'), icon: 'navigate' as const, onPress: onGo };

  return (
    <Card variant="glow" padding={Spacing.lg}>
      <View style={styles.head}>
        {actions && (
          <View style={[styles.badge, { backgroundColor: tone }]}>
            <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '800' }}>
              {t(`live.status.${status}`)}
            </Text>
          </View>
        )}
        <Text variant="caption" color="textMuted">
          {index + 1}/{total}
        </Text>
        {stop.is_locked && <Ionicons name="lock-closed" size={13} color={colors.textMuted} />}
      </View>

      <Text variant="title" numberOfLines={2} style={status === 'skipped' ? styles.strike : undefined}>
        {stop.title}
      </Text>
      <Text variant="caption" color="textSecondary" numberOfLines={1}>
        {[start && end ? `${start} – ${end}` : start, stop.address].filter(Boolean).join(' · ')}
      </Text>
      {stop.rating !== null && <PlaceMeta rating={stop.rating} ratingCount={stop.rating_count} priceLevel={null} distanceM={null} />}

      {(when || etaMin !== null || leave !== null) && status !== 'done' && status !== 'skipped' && (
        <View style={styles.pills}>
          {when && (
            <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="time-outline" size={14} color={colors.textSecondary} />
              <Text variant="caption">{when}</Text>
            </View>
          )}
          {etaMin !== null && status !== 'here' && (
            <View style={[styles.pill, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name={MODE_ICON[etaMode]} size={14} color={colors.textSecondary} />
              <Text variant="caption">{t('live.strip.eta', { min: etaMin })}</Text>
            </View>
          )}
          {leave !== null && (
            <View style={[styles.pill, { backgroundColor: leaveTone }]}>
              <Text variant="caption" style={styles.pillText}>
                {leave > 1 ? t('live.strip.leaveIn', { min: leave }) : t('live.strip.leaveNow')}
              </Text>
            </View>
          )}
        </View>
      )}

      {actions && <Button title={primary.title} icon={primary.icon} onPress={primary.onPress} style={styles.primary} />}
      <View style={styles.row}>
        {actions && status !== 'done' && status !== 'skipped' && <Chip icon="play-skip-forward-outline" label={t('live.guidance.skip')} onPress={onSkip} />}
        {actions && (status === 'next' || status === 'now' || status === 'later' || status === 'past') && <Chip icon="location-outline" label={t('live.act.here')} onPress={onArrive} />}
        <Chip icon="navigate-outline" label={t('route.howToGet')} onPress={onDirections} />
        {onDetails && <Chip icon="images-outline" label={t('place.details')} onPress={onDetails} />}
      </View>

      {following ? (
        <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.after}>
          {t('live.hero.after', { title: following.title, time: following.starts_at ? formatTime(following.starts_at, timezone) : '–' })}
        </Text>
      ) : (
        <Text variant="caption" color="textMuted" style={styles.after}>
          {t('live.hero.lastStop')}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.xs },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  strike: { textDecorationLine: 'line-through' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.pill },
  pillText: { color: '#FFFFFF', fontWeight: '700' },
  primary: { marginTop: Spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  after: { marginTop: Spacing.sm },
});
