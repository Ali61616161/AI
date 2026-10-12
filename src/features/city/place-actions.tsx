import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { SaveLimitError, useMarkVisited, useSavedPlaces, useSavePlace, useVisits, type PlaceInput } from './api';

/** "Kaydet" ve "Gittim" düğmeleri; yer Google ile doğrulanmışsa (kimliği varsa) gösterilir. */
export function PlaceActions({ place }: { place: PlaceInput | null }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const { data: saved } = useSavedPlaces();
  const { data: visits } = useVisits();
  const save = useSavePlace();
  const visit = useMarkVisited();
  if (!signedIn || !place?.google_place_id) return null;

  const isSaved = saved?.some((s) => s.google_place_id === place.google_place_id) ?? false;
  const today = new Date().toISOString().slice(0, 10);
  const visitedToday = visits?.some((v) => v.google_place_id === place.google_place_id && v.visited_on === today) ?? false;
  const visitedBefore = visits?.some((v) => v.google_place_id === place.google_place_id) ?? false;

  return (
    <View style={styles.row}>
      <Tap
        accessibilityRole="button"
        accessibilityState={{ selected: isSaved }}
        disabled={isSaved || save.isPending}
        onPress={() =>
          save.mutate(
            { place },
            {
              onSuccess: () => haptic.success(),
              onError: (e) => {
                if (e instanceof SaveLimitError) router.push({ pathname: '/paywall', params: { reason: 'quota' } });
              },
            },
          )
        }
        style={styles.flex}
        feedback="select">
        <View style={[styles.button, { borderColor: isSaved ? colors.primary : colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={15} color={isSaved ? colors.primary : colors.textSecondary} />
          <Text variant="caption" color={isSaved ? 'primary' : 'textSecondary'}>
            {isSaved ? t('city.saved') : t('city.save')}
          </Text>
        </View>
      </Tap>
      <Tap
        accessibilityRole="button"
        accessibilityState={{ selected: visitedToday }}
        disabled={visitedToday || visit.isPending}
        onPress={() => visit.mutate(place, { onSuccess: () => haptic.success() })}
        style={styles.flex}
        feedback="select">
        <View style={[styles.button, { borderColor: visitedToday ? colors.success : colors.border, backgroundColor: colors.surface }]}>
          <Ionicons name={visitedToday ? 'checkmark-circle' : 'checkmark-circle-outline'} size={15} color={visitedToday ? colors.success : colors.textSecondary} />
          <Text variant="caption" color={visitedToday ? 'success' : 'textSecondary'}>
            {visitedToday ? t('city.visitedToday') : visitedBefore ? t('city.visitAgain') : t('city.visited')}
          </Text>
        </View>
      </Tap>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  button: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 36, borderRadius: Radius.pill, borderWidth: 1 },
});
