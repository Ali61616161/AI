import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { BUDGETS, COMPANIONS } from '@/features/profile/options';
import { useTrips } from '@/features/trips/queries';
import { TripCard } from '@/features/trips/trip-card';
import { todayIsoDate } from '@/lib/format';
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
  const companion = COMPANIONS.find((c) => c.value === preferences.companion);
  const budget = BUDGETS.find((b) => b.value === preferences.budget);
  const { data: trips } = useTrips();
  const today = todayIsoDate();
  const nextTrip = trips?.find((trip) => !trip.end_date || trip.end_date >= today);

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
