import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { TripListItem } from './queries';

/** Gitmeden önce işe yarayanlar: vize/giriş, bavul, harcama ve acil cümleler (tek dokunuşla). */
export function PreTripTools({ trip }: { trip: TripListItem }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const country = trip.trip_destinations[0]?.country_code ?? '';
  const tiles = [
    { key: 'visa', icon: 'document-text-outline' as const, label: t('tools.visa'), go: () => router.push({ pathname: '/visa', params: { tripId: trip.id } }) },
    { key: 'packing', icon: 'briefcase-outline' as const, label: t('tools.packing'), go: () => router.push({ pathname: '/packing', params: { tripId: trip.id } }) },
    { key: 'expenses', icon: 'wallet-outline' as const, label: t('tools.expenses'), go: () => router.push({ pathname: '/expenses', params: { tripId: trip.id } }) },
    { key: 'phrases', icon: 'chatbubbles-outline' as const, label: t('phrases.shortTitle'), go: () => router.push({ pathname: '/phrases', params: { country } }) },
  ];
  return (
    <View style={styles.wrap}>
      <Text variant="subtitle">{t('brief.beforeYouGo')}</Text>
      <View style={styles.grid}>
        {tiles.map((x) => (
          <Tap key={x.key} accessibilityRole="button" accessibilityLabel={x.label} onPress={x.go} scaleTo={0.97} style={styles.cell}>
            <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={x.icon} size={22} color={colors.primary} />
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
  wrap: { gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  cell: { width: '48%' },
  tile: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
});
