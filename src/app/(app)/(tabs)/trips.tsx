import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useTrips } from '@/features/trips/queries';
import { TripCard } from '@/features/trips/trip-card';
import { todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Segment = 'upcoming' | 'past';

export default function TripsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [segment, setSegment] = useState<Segment>('upcoming');
  const { data: trips, isLoading, isError, refetch } = useTrips();

  const today = todayIsoDate();
  const isPast = (end: string | null) => Boolean(end && end < today);
  const upcoming = trips?.filter((trip) => !isPast(trip.end_date)) ?? [];
  // Geçmiş seyahatler en yeniden eskiye.
  const past = trips?.filter((trip) => isPast(trip.end_date)).reverse() ?? [];
  const list = segment === 'upcoming' ? upcoming : past;

  return (
    <Screen edges={['top']} tabBarSpace>
      <Text variant="display">{t('trips.title')}</Text>

      <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {(['upcoming', 'past'] as const).map((s) => {
          const active = s === segment;
          return (
            <Pressable
              key={s}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSegment(s)}
              style={[styles.segment, active && { backgroundColor: colors.surface }]}>
              <Text variant="bodyStrong" color={active ? 'text' : 'textSecondary'}>
                {t(`trips.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator color={colors.primary} />
      ) : isError ? (
        <EmptyState icon="cloud-offline-outline" title={t('trips.loadFailed')} description={t('ticket.errors.network')}>
          <Button title={t('common.retry')} variant="secondary" onPress={() => refetch()} />
        </EmptyState>
      ) : list.length > 0 ? (
        <View style={styles.list}>
          {list.map((trip, index) => (
            <TripCard key={trip.id} trip={trip} highlight={segment === 'upcoming' && index === 0} />
          ))}
          {segment === 'upcoming' && (
            <>
              <Button title={t('today.uploadTicket')} variant="secondary" onPress={() => router.push('/ticket')} />
              <Button title={t('today.createManually')} variant="ghost" onPress={() => router.push('/trip-new')} />
            </>
          )}
        </View>
      ) : segment === 'upcoming' ? (
        <EmptyState
          icon="calendar-outline"
          title={t('trips.emptyUpcomingTitle')}
          description={t('trips.emptyUpcomingDescription')}>
          <Button title={t('today.uploadTicket')} onPress={() => router.push('/ticket')} />
          <Button title={t('today.createManually')} variant="secondary" onPress={() => router.push('/trip-new')} />
        </EmptyState>
      ) : (
        <EmptyState icon="trophy-outline" title={t('trips.emptyPastTitle')} description={t('trips.emptyPastDescription')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', padding: Spacing.xs, borderRadius: Radius.pill },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.pill },
  list: { gap: Spacing.md },
});
