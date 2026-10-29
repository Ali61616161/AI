import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { DateField } from '@/components/ui/date-field';
import { ReplanError, useChangeDates, useCrisisReplan, useRestoreVersion, type DatesResult } from '@/features/plan/replan';
import { isBlankOrClock, normalizeAnswers, type TripAnswers } from '@/features/trips/trip-answers';
import { TripTimeFields } from '@/features/trips/trip-questions';
import { getSupabase } from '@/lib/supabase';
import { useActivePlan, useTrip } from '@/features/trips/queries';
import { formatDayShort } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { datesBetween } from '../../../supabase/functions/_shared/itinerary.ts';
import { analyzeDateChange } from '../../../supabase/functions/_shared/replan.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 30;

function isValidDate(value: string) {
  return DATE.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().startsWith(value);
}

function Impact({ icon, text, tone = 'textSecondary' }: { icon: ComponentProps<typeof Ionicons>['name']; text: string; tone?: 'textSecondary' | 'warning' }) {
  const { colors } = useTheme();
  return (
    <View style={styles.impact}>
      <Ionicons name={icon} size={18} color={tone === 'warning' ? colors.warning : colors.textSecondary} />
      <Text variant="body" color={tone} style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

/** Seyahatin tarihlerini değiştirir; uygulamadan önce etkisini gösterir. */
export default function TripDatesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan } = useActivePlan(tripId);
  const change = useChangeDates(tripId);
  const restore = useRestoreVersion(tripId);
  const adjust = useCrisisReplan();
  const [times, setTimes] = useState<Partial<Pick<TripAnswers, 'arrivalTime' | 'arrivalAirport' | 'departureTime' | 'departureAirport'>>>({});
  const [saving, setSaving] = useState(false);
  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [result, setResult] = useState<DatesResult | null>(null);
  const [undone, setUndone] = useState(false);

  const startValue = start ?? trip?.start_date ?? '';
  const endValue = end ?? trip?.end_date ?? '';
  const valid =
    isValidDate(startValue) && isValidDate(endValue) && endValue >= startValue && datesBetween(startValue, endValue, MAX_DAYS + 1).length <= MAX_DAYS;
  const unchanged = startValue === trip?.start_date && endValue === trip?.end_date;
  const timeValues = {
    arrivalTime: times.arrivalTime ?? trip?.arrival_time?.slice(0, 5) ?? '',
    arrivalAirport: times.arrivalAirport ?? trip?.arrival_airport ?? '',
    departureTime: times.departureTime ?? trip?.departure_time?.slice(0, 5) ?? '',
    departureAirport: times.departureAirport ?? trip?.departure_airport ?? '',
  };
  const timesValid = isBlankOrClock(timeValues.arrivalTime) && isBlankOrClock(timeValues.departureTime);
  const timesChanged = Object.keys(times).length > 0 && JSON.stringify(timeValues) !== JSON.stringify({ arrivalTime: trip?.arrival_time?.slice(0, 5) ?? '', arrivalAirport: trip?.arrival_airport ?? '', departureTime: trip?.departure_time?.slice(0, 5) ?? '', departureAirport: trip?.departure_airport ?? '' });

  // Saatleri kaydeder; tarih değişmediyse sadece ilk ve son gün yeni saatlere göre düzenlenir.
  async function apply() {
    setSaving(true);
    try {
      if (timesChanged) {
        const n = normalizeAnswers({ companion: 'solo', budget: 'mid', dailyBudget: '', currency: 'USD', interests: [], transport: 'mixed', notes: '', hotels: [], ...timeValues });
        const { error } = await getSupabase().from('trips').update({ arrival_time: n.arrivalTime, departure_time: n.departureTime, arrival_airport: n.arrivalAirport, departure_airport: n.departureAirport }).eq('id', tripId);
        if (error) throw error;
      }
      if (!unchanged) {
        setResult(await change.mutateAsync({ start: startValue, end: endValue }));
      } else if (timesChanged) {
        await adjust.mutateAsync({ message: `My flight times are: lands ${timeValues.arrivalTime || 'not set'}${timeValues.arrivalAirport ? ` at ${timeValues.arrivalAirport}` : ''}, return flight leaves ${timeValues.departureTime || 'not set'}${timeValues.departureAirport ? ` from ${timeValues.departureAirport}` : ''}. Adjust only the first and last day of the trip accordingly.`, tripId });
        router.back();
      }
    } catch {
      // hata mesajı change.error / adjust.error üzerinden gösterilir
    } finally {
      setSaving(false);
    }
  }

  const analysis = useMemo(() => {
    if (!trip?.start_date || !trip.end_date || !valid || unchanged) return null;
    return analyzeDateChange({
      oldStart: trip.start_date,
      oldEnd: trip.end_date,
      newStart: startValue,
      newEnd: endValue,
      reservations: trip.reservations,
      planDays: plan?.day_plans ?? [],
    });
  }, [trip, plan, startValue, endValue, valid, unchanged]);

  const list = (dates: string[]) => dates.map(formatDayShort).join(', ');

  if (!trip) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  if (result) {
    return (
      <Screen footer={<Button title={t('common.done')} onPress={() => router.back()} />}>
        <ModalHeader title={t('dates.resultTitle')} />
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="subtitle">{t('dates.removedTitle')}</Text>
          {result.removed.length === 0 ? (
            <Text variant="body" color="textSecondary">
              {t('dates.nothingRemoved')}
            </Text>
          ) : (
            result.removed.map((r, i) => (
              <Impact key={i} icon="remove-circle-outline" text={`${formatDayShort(r.date)} · ${r.title}`} />
            ))
          )}
        </View>
        {result.previous_version_id && !undone && (
          <Button
            title={t('dates.undo')}
            variant="secondary"
            loading={restore.isPending}
            onPress={async () => {
              await restore.mutateAsync(result.previous_version_id!);
              setUndone(true);
            }}
          />
        )}
        {undone && (
          <Text variant="body" color="textSecondary" style={styles.center}>
            {t('assistant.undone')}
          </Text>
        )}
      </Screen>
    );
  }

  const changeError = change.error ? t(`plan.errors.${change.error instanceof ReplanError ? change.error.code : 'network'}`) : null;

  return (
    <Screen
      footer={
        <>
          {changeError && (
            <Text variant="caption" color="danger" style={styles.center}>
              {changeError}
            </Text>
          )}
          <Button
            title={t('dates.apply')}
            disabled={!valid || !timesValid || (unchanged && !timesChanged)}
            loading={saving || change.isPending || adjust.isPending}
            onPress={apply}
          />
        </>
      }>
      <ModalHeader title={t('dates.title')} subtitle={t('dates.subtitle')} />
      <View style={styles.row}>
        <View style={styles.flex}>
          <DateField label={t('dates.start')} value={startValue} onChange={setStart} />
        </View>
        <View style={styles.flex}>
          <DateField label={t('dates.end')} value={endValue} min={startValue || null} onChange={setEnd} />
        </View>
      </View>
      {!valid && (startValue.length === 10 && endValue.length === 10) && (
        <Text variant="caption" color="danger">
          {t('dates.invalid')}
        </Text>
      )}

      <View style={styles.timesBlock}>
        <Text variant="subtitle">{t('tripQuestions.flightTimesTitle')}</Text>
        <TripTimeFields value={timeValues} onChange={(patch) => setTimes((prev) => ({ ...prev, ...patch }))} timeError={!timesValid} />
      </View>

      {unchanged && !timesChanged ? (
        <Text variant="body" color="textMuted">
          {t('dates.noChange')}
        </Text>
      ) : (
        analysis && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="subtitle">{t('dates.impactTitle')}</Text>
            {analysis.removedDates.length > 0 && <Impact icon="remove-circle-outline" text={t('dates.removedDays', { count: analysis.removedDates.length })} />}
            {analysis.addedDates.length > 0 && <Impact icon="add-circle-outline" text={t('dates.addedDays', { count: analysis.addedDates.length })} />}
            {analysis.reservationsOutside.length > 0 && (
              <Impact
                icon="alert-circle-outline"
                tone="warning"
                text={t('dates.outside', { list: analysis.reservationsOutside.map((r) => `${r.title} (${formatDayShort(r.date)})`).join(', ') })}
              />
            )}
            {analysis.uncoveredNights.length > 0 && (
              <Impact icon="bed-outline" tone="warning" text={t('dates.uncovered', { list: list(analysis.uncoveredNights) })} />
            )}
            {analysis.removedHighlights.length > 0 && (
              <Impact icon="star-outline" text={t('dates.highlights', { list: analysis.removedHighlights.map((h) => h.title).join(', ') })} />
            )}
          </View>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  timesBlock: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
  card: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  impact: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-start' },
});
