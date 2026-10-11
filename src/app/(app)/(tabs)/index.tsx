import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useIsOnline } from '@/features/offline/use-online';
import { OpenNowSection } from '@/features/places/open-now-section';
import { BUDGETS, COMPANIONS } from '@/features/profile/options';
import { useTrips } from '@/features/trips/queries';
import { TripCard } from '@/features/trips/trip-card';
import { isoDateDaysAgo, todayIsoDate } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return 'today.greetingMorning' as const;
  if (hour >= 12 && hour < 18) return 'today.greetingAfternoon' as const;
  if (hour >= 18 && hour < 23) return 'today.greetingEvening' as const;
  return 'today.greetingNight' as const;
}

const FEATURES: { icon: ComponentProps<typeof Ionicons>['name']; key: 'featureReplan' | 'featureOffline' | 'featureMenu' }[] = [
  { icon: 'sparkles-outline', key: 'featureReplan' },
  { icon: 'cloud-offline-outline', key: 'featureOffline' },
  { icon: 'restaurant-outline', key: 'featureMenu' },
];

export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const preferences = useSessionStore((s) => s.preferences);
  const session = useSessionStore((s) => s.session);
  const online = useIsOnline();
  const companion = COMPANIONS.find((c) => c.value === preferences.companion);
  const budget = BUDGETS.find((b) => b.value === preferences.budget);
  const { data: trips } = useTrips();
  const today = todayIsoDate();
  const nextTrip = trips?.find((trip) => !trip.end_date || trip.end_date >= today);
  // Son 30 günde biten ve henüz raporu oluşturulmamış seyahat.
  const monthAgo = isoDateDaysAgo(30);
  const endedTrip = trips?.find((trip) => trip.end_date && trip.end_date < today && trip.end_date >= monthAgo && trip.status !== 'completed');

  return (
    <Screen edges={['top']}>
      <Text variant="display">{t(greetingKey(new Date().getHours()))}</Text>

      {nextTrip ? (
        <View style={styles.section}>
          <Text variant="subtitle">{t('today.nextTrip')}</Text>
          <TripCard trip={nextTrip} highlight />
        </View>
      ) : (
        <EmptyState icon="airplane-outline" title={t('today.noTripTitle')} description={t('today.noTripDescription')}>
          <Button title={t('today.uploadTicket')} onPress={() => router.push('/ticket')} />
          <Button title={t('today.createManually')} variant="secondary" disabled />
        </EmptyState>
      )}

      {endedTrip && (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/trip-report', params: { tripId: endedTrip.id } })}
          style={[styles.feature, { backgroundColor: colors.primarySoft, borderColor: colors.primary }]}>
          <View style={[styles.featureIcon, { backgroundColor: colors.surface }]}>
            <Ionicons name="trophy-outline" size={22} color={colors.primary} />
          </View>
          <View style={styles.featureText}>
            <Text variant="bodyStrong">{t('report.endedTitle', { trip: endedTrip.title })}</Text>
            <Text variant="caption" color="textSecondary">
              {t('report.ctaBody')}
            </Text>
          </View>
        </Pressable>
      )}

      {session && isSupabaseConfigured() && online && <OpenNowSection />}

      {(companion || budget) && (
        <View style={styles.section}>
          <Text variant="subtitle">{t('today.yourProfile')}</Text>
          <View style={styles.chips}>
            {companion && <Chip icon={companion.icon} label={t(`companion.${companion.value}`)} />}
            {budget && <Chip icon={budget.icon} label={t(`budget.${budget.value}`)} />}
            {preferences.interests.slice(0, 4).map((i) => (
              <Chip key={i} label={t(`interest.${i}` as 'interest.art')} />
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="subtitle">{t('today.featuresTitle')}</Text>
        {FEATURES.map((f) => (
          <View key={f.key} style={[styles.feature, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.featureIcon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name={f.icon} size={22} color={colors.primary} />
            </View>
            <Text variant="body" style={styles.featureText}>
              {t(`today.${f.key}`)}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  featureIcon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  featureText: { flex: 1 },
});
