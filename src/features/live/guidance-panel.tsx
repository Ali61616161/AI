import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useCrisisReplan } from '@/features/plan/replan';
import { formatTime } from '@/lib/format';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { LATE_WARN_MIN, type DriftStop } from './drift-logic';
import { useLiveStore } from './live-store';
import { airportSearchName, type useLiveGuidance } from './use-live-guidance';

type Guidance = ReturnType<typeof useLiveGuidance>;
type Props = { tripId: string; guidance: Guidance; timezone: string | null; nowMs: number; canEdit?: boolean };

/**
 * Canlı görünümde plana uyma kartları: saati geçmiş durağa "gittim / atla / düzenle", yetişemeyeceğin
 * durak uyarısı ve yaklaşan uçuş için havalimanına en geç çıkış zamanı.
 */
export function GuidancePanel({ tripId, guidance, timezone, nowMs, canEdit = true }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const mark = useLiveStore((s) => s.mark);
  const replan = useCrisisReplan();
  const [done, setDone] = useState(false);
  const { overdue, upcoming, late, flight, leaveAt, airportName, airportTravelMin } = guidance;

  const fix = async (stop: DriftStop, reason: 'overdue' | 'late') => {
    setDone(false);
    const at = stop.starts_at ? formatTime(stop.starts_at, timezone) : '';
    const message =
      reason === 'overdue'
        ? `I was supposed to be at "${stop.title}" at ${at} but I am not there and I am skipping or running behind. Rearrange the rest of today around where I am now. Keep locked bookings and flights exactly as they are.`
        : `I will probably be about ${late} minutes late to "${stop.title}" (${at}). Rearrange the rest of today so it still works, around where I am now. Keep locked bookings and flights exactly as they are.`;
    try {
      await replan.mutateAsync({ message, tripId });
      if (reason === 'overdue') mark(stop.id, 'skipped');
      setDone(true);
    } catch {
      // hata mesajı replan.isError üzerinden gösterilir
    }
  };

  const cards: React.ReactNode[] = [];

  if (flight && leaveAt !== null && leaveAt - nowMs < 8 * 3_600_000) {
    const minutesLeft = Math.round((leaveAt - nowMs) / 60_000);
    cards.push(
      <Card key="airport" variant="glow" padding={Spacing.md}>
        <View style={styles.row}>
          <Ionicons name="airplane" size={22} color={colors.primary} />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{minutesLeft > 0 ? t('live.guidance.leaveBy', { time: formatTime(new Date(leaveAt).toISOString(), timezone) }) : t('live.guidance.leaveNow')}</Text>
            <Text variant="caption" color="textSecondary">
              {t('live.guidance.airportBody', { airport: airportName ?? '', min: airportTravelMin ?? 0 })}
            </Text>
          </View>
          <Button title={t('route.howToGet')} variant="secondary" onPress={() => router.push({ pathname: '/route', params: { toName: airportName ? airportSearchName(airportName) : '', tripId } })} />
        </View>
      </Card>,
    );
  }

  if (overdue) {
    cards.push(
      <Card key="overdue" variant="glow" padding={Spacing.md}>
        <Text variant="bodyStrong">{t('live.guidance.overdueTitle', { title: overdue.title, time: overdue.starts_at ? formatTime(overdue.starts_at, timezone) : '' })}</Text>
        <View style={styles.actions}>
          <Button title={t('live.guidance.went')} onPress={() => mark(overdue.id, 'done')} style={styles.flex} />
          <Button title={t('live.guidance.skip')} variant="secondary" onPress={() => mark(overdue.id, 'skipped')} style={styles.flex} />
        </View>
        {canEdit && <Button title={t('live.guidance.rearrange')} variant="ghost" loading={replan.isPending} onPress={() => fix(overdue, 'overdue')} />}
      </Card>,
    );
  } else if (upcoming && late !== null && late >= LATE_WARN_MIN) {
    cards.push(
      <Card key="late" variant="glow" padding={Spacing.md}>
        <View style={styles.row}>
          <Ionicons name="alert-circle" size={22} color={colors.warning} />
          <Text variant="bodyStrong" style={styles.flex}>
            {t('live.guidance.lateTitle', { title: upcoming.title, min: late })}
          </Text>
        </View>
        {canEdit && <Button title={t('live.guidance.rearrange')} loading={replan.isPending} onPress={() => fix(upcoming, 'late')} />}
      </Card>,
    );
  }

  if (done) {
    cards.push(
      <Card key="done" variant="solid" padding={Spacing.md}>
        <Text variant="caption" color="success">
          {t('live.guidance.rearranged')}
        </Text>
      </Card>,
    );
  }
  if (replan.isError) {
    cards.push(
      <Card key="err" variant="solid" padding={Spacing.md}>
        <Text variant="caption" color="danger">
          {t('live.guidance.rearrangeFailed')}
        </Text>
      </Card>,
    );
  }
  return cards.length ? <View style={styles.wrap}>{cards}</View> : null;
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
});
