import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { jetLagPlan } from '@/features/tools/jetlag';
import { useTrip } from '@/features/trips/queries';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Jet lag planı: ilk uçuşun kalkış ve varış saat dilimlerine göre. */
export default function JetLagScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const flight = trip?.reservations.find((r) => r.type === 'flight' && r.start_timezone && r.end_timezone && r.start_timezone !== r.end_timezone);

  if (!flight) {
    return (
      <Screen>
        <ModalHeader title={t('jetlag.title')} />
        <EmptyState icon="airplane-outline" title={t('jetlag.noFlightTitle')} description={t('jetlag.noFlightBody')} />
      </Screen>
    );
  }

  const plan = jetLagPlan(flight.start_timezone!, flight.end_timezone!, new Date(flight.starts_at));
  const hours = Math.abs(plan.hours);
  const tips: { icon: ComponentProps<typeof Ionicons>['name']; text: string }[] =
    plan.direction === 'none'
      ? [{ icon: 'happy-outline', text: t('jetlag.noneTip') }]
      : [
          ...(plan.daysBefore
            ? [{ icon: 'moon-outline' as const, text: t(plan.direction === 'east' ? 'jetlag.beforeEast' : 'jetlag.beforeWest', { count: plan.daysBefore }) }]
            : []),
          { icon: 'airplane-outline', text: t('jetlag.onBoard') },
          { icon: 'sunny-outline', text: t(plan.direction === 'east' ? 'jetlag.lightEast' : 'jetlag.lightWest') },
          { icon: 'cafe-outline', text: t('jetlag.caffeine') },
          { icon: 'bed-outline', text: t('jetlag.nap') },
          { icon: 'water-outline', text: t('jetlag.water') },
        ];

  return (
    <Screen>
      <ModalHeader title={t('jetlag.title')} subtitle={flight.title} />
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="display">{plan.direction === 'none' ? '0' : `${plan.hours > 0 ? '+' : '−'}${hours}`}</Text>
        <Text variant="body" color="textSecondary">
          {plan.direction === 'none' ? t('jetlag.none') : t(plan.direction === 'east' ? 'jetlag.east' : 'jetlag.west', { count: hours })}
        </Text>
        {plan.direction !== 'none' && (
          <Text variant="bodyStrong" color={plan.severity === 'strong' ? 'danger' : plan.severity === 'moderate' ? 'warning' : 'success'}>
            {t('jetlag.recovery', { count: plan.recoveryDays })}
          </Text>
        )}
      </View>
      {tips.map((tip) => (
        <View key={tip.text} style={[styles.tip, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={tip.icon} size={20} color={colors.primary} />
          <Text variant="body" style={styles.flex}>
            {tip.text}
          </Text>
        </View>
      ))}
      <Text variant="caption" color="textMuted">
        {t('jetlag.disclaimer')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.xs, padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1 },
  tip: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.md },
  flex: { flex: 1 },
});
