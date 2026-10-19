import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Features } from '@/config/features';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { useTripWeather } from '@/features/places/api';
import { formatTime, todayIsoDate } from '@/lib/format';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useActivePlan, type TripListItem } from './queries';

const SHOWN = 3;

/**
 * Seyahat sürerken ana sayfa: bugünün sıradaki durakları, hava durumu ve tek dokunuşla canlı görünüm,
 * cüzdan, çeviri ve acil durum.
 */
export function TripToday({ trip }: { trip: TripListItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const today = todayIsoDate();
  const { data: plan } = useActivePlan(trip.id);
  const weather = useTripWeather(trip.id);
  const day = plan?.day_plans.find((d) => d.date === today);
  // Sıradaki duraklar dakikada bir yenilenir.
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  // Saati geçmemiş (ya da 30 dakikadır süren) duraklar; hiçbiri kalmadıysa günün son durakları.
  const timed = (day?.plan_items ?? []).filter((i) => i.starts_at && i.kind !== 'transport');
  const upcoming = timed.filter((i) => Date.parse(i.starts_at!) > nowMs - 30 * 60_000);
  const list = (upcoming.length ? upcoming : timed.slice(-SHOWN)).slice(0, SHOWN);
  const forecast = weather.data?.days.find((d) => d.date === today);

  const tiles = [
    { key: 'wallet', icon: 'wallet' as const, label: t('wallet.title'), go: () => router.push({ pathname: '/wallet', params: { tripId: trip.id } }) },
    { key: 'translate', icon: 'language' as const, label: t('today.quick.translate'), go: () => router.push('/translate') },
    { key: 'sos', icon: 'medkit' as const, label: t('today.quick.sos'), go: () => router.push({ pathname: '/sos', params: { tripId: trip.id } }) },
    ...(Features.social ? [{ key: 'social', icon: 'people' as const, label: t('today.quick.travelers'), go: () => router.push('/social') }] : []),
  ];

  return (
    <View style={styles.wrap}>
      <Card variant="solid" padding={Spacing.lg}>
        <View style={styles.head}>
          <Text variant="subtitle">{t('tripToday.title')}</Text>
          {forecast && forecast.max !== null && (
            <View style={styles.weather}>
              <Ionicons name="partly-sunny-outline" size={16} color={colors.primary} />
              <Text variant="caption" color="textSecondary">
                {Math.round(forecast.max)}° / {forecast.min !== null ? Math.round(forecast.min) : '–'}°
              </Text>
            </View>
          )}
        </View>
        {list.length === 0 ? (
          <Text variant="caption" color="textSecondary">
            {plan ? t('tripToday.noStops') : t('tripToday.noPlan')}
          </Text>
        ) : (
          list.map((item) => (
            <Tap key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => router.push({ pathname: '/trip-live', params: { tripId: trip.id } })} feedback="select">
              <View style={styles.stop}>
                <Text variant="caption" color="primary" style={styles.time}>
                  {formatTime(item.starts_at!, item.timezone)}
                </Text>
                <Text variant="body" numberOfLines={1} style={styles.flex}>
                  {item.title}
                </Text>
              </View>
            </Tap>
          ))
        )}
        <Button title={t('live.open')} icon="navigate-circle-outline" onPress={() => router.push({ pathname: '/trip-live', params: { tripId: trip.id } })} />
      </Card>

      <View style={styles.tiles}>
        {tiles.map((x) => (
          <Tap key={x.key} accessibilityRole="button" accessibilityLabel={x.label} onPress={x.go} scaleTo={0.96} style={styles.flex}>
            <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={x.icon} size={22} color={x.key === 'sos' ? colors.danger : colors.primary} />
              <Text variant="caption" numberOfLines={1}>
                {x.label}
              </Text>
            </View>
          </Tap>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.xs },
  weather: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  stop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.sm },
  time: { width: 48 },
  flex: { flex: 1 },
  tiles: { flexDirection: 'row', gap: Spacing.sm },
  tile: { alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, borderRadius: 18, borderWidth: 1 },
});
