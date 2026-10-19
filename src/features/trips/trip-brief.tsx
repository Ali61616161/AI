import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { useTripWeather } from '@/features/places/api';
import { getRate } from '@/lib/fx';
import { daysUntil, todayIsoDate } from '@/lib/format';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { currencyFor } from '../../../supabase/functions/_shared/city.ts';
import { useActivePlan, useTrip, type TripListItem } from './queries';
import { readinessItems, readinessProgress, type ReadinessKey } from './readiness';

const ACTION: Record<ReadinessKey, (tripId: string) => void> = {
  ticket: (id) => router.push({ pathname: '/ticket', params: { tripId: id } }),
  hotel: (id) => router.push({ pathname: '/hotels', params: { tripId: id } }),
  plan: (id) => router.push(`/trip/${id}`),
  times: (id) => router.push({ pathname: '/trip-dates', params: { tripId: id } }),
};

/**
 * Ana sayfada seyahat özeti: gideceğin yerin hava durumu, yerel para biriminin kuru ve seyahate hazırlık
 * (eksikler dokununca doğrudan ilgili ekranı açar).
 */
export function TripBrief({ trip }: { trip: TripListItem }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { data: detail } = useTrip(trip.id);
  const { data: plan } = useActivePlan(trip.id);
  const weather = useTripWeather(trip.id);
  const country = trip.trip_destinations[0]?.country_code ?? null;
  const city = trip.trip_destinations[0]?.city ?? trip.title;
  const homeCurrency = getLocales()[0]?.currencyCode ?? 'USD';
  const destCurrency = currencyFor(country, homeCurrency);
  const [rate, setRate] = useState<number | null>(null);

  useEffect(() => {
    if (destCurrency === homeCurrency) return;
    let alive = true;
    getRate(destCurrency, homeCurrency).then((r) => alive && setRate(r));
    return () => {
      alive = false;
    };
  }, [destCurrency, homeCurrency]);

  const day = weather.data?.days.find((d) => d.date === trip.start_date) ?? weather.data?.days[0] ?? null;
  const reservations = detail?.reservations ?? [];
  const items = readinessItems({
    hasFlightOrTransport: reservations.some((r) => r.type === 'flight' || r.type === 'train' || r.type === 'bus'),
    hasHotel: reservations.some((r) => r.type === 'hotel'),
    hasPlan: Boolean(plan),
    hasFlightTimes: Boolean(detail?.arrival_time || detail?.departure_time),
    daysUntilStart: trip.start_date ? daysUntil(trip.start_date, new Date(`${todayIsoDate()}T12:00:00`)) : null,
  });
  const { done, total } = readinessProgress(items);
  const fmt = (n: number) => new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 2 }).format(n);
  const money = (n: number, c: string) => new Intl.NumberFormat(i18n.language, { style: 'currency', currency: c, maximumFractionDigits: 2 }).format(n);

  return (
    <Card variant="solid" padding={Spacing.lg}>
      <Text variant="subtitle">{t('brief.title', { city })}</Text>
      <View style={styles.facts}>
        {day && day.max !== null && (
          <View style={styles.fact}>
            <Ionicons name="partly-sunny-outline" size={18} color={colors.primary} />
            <Text variant="caption" color="textSecondary">
              {t('brief.weather', { max: fmt(Math.round(day.max)), min: day.min !== null ? fmt(Math.round(day.min)) : '–', description: day.description ?? '' })}
            </Text>
          </View>
        )}
        {!day && weather.data?.available_from && (
          <View style={styles.fact}>
            <Ionicons name="partly-sunny-outline" size={18} color={colors.textMuted} />
            <Text variant="caption" color="textMuted">
              {t('brief.weatherLater')}
            </Text>
          </View>
        )}
        {rate !== null && destCurrency !== homeCurrency && (
          <View style={styles.fact}>
            <Ionicons name="cash-outline" size={18} color={colors.primary} />
            <Text variant="caption" color="textSecondary">
              {`1 ${destCurrency} = ${money(rate, homeCurrency)}`}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.progressHead}>
        <Text variant="caption" color="textSecondary">
          {t('brief.readiness')}
        </Text>
        <Text variant="caption" color={done === total ? 'success' : 'textSecondary'}>
          {done}/{total}
        </Text>
      </View>
      <View style={[styles.bar, { backgroundColor: colors.surfaceMuted }]}>
        <View style={[styles.barFill, { backgroundColor: done === total ? colors.success : colors.primary, width: `${(done / total) * 100}%` }]} />
      </View>
      <View style={styles.chips}>
        {items
          .filter((x) => !x.done)
          .map((x) => (
            <Chip key={x.key} icon="add-circle-outline" label={t(`brief.todo.${x.key}`)} onPress={() => ACTION[x.key](trip.id)} />
          ))}
        {done === total && (
          <Text variant="caption" color="success">
            {t('brief.allReady')}
          </Text>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  facts: { gap: Spacing.xs, marginTop: Spacing.xs },
  fact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginTop: Spacing.md },
  bar: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: Spacing.xs },
  barFill: { height: 6, borderRadius: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
});
