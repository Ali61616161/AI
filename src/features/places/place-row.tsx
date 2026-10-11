import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { formatDistance, openInMaps, type Place } from './api';

/** Puan, yorum sayısı, fiyat seviyesi ve mesafeyi tek satırda gösterir. */
export function PlaceMeta({ rating, ratingCount, priceLevel, distanceM }: Pick<Place, 'rating' | 'ratingCount' | 'priceLevel' | 'distanceM'>) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const distance = formatDistance(distanceM, i18n.language);
  return (
    <View style={styles.meta}>
      {rating !== null && (
        <View style={styles.rating}>
          <Ionicons name="star" size={12} color={colors.warning} />
          <Text variant="caption" style={styles.bold}>
            {rating.toFixed(1)}
          </Text>
          {ratingCount !== null && (
            <Text variant="caption" color="textMuted">
              ({t('place.reviews', { count: ratingCount, formatted: new Intl.NumberFormat(i18n.language, { notation: ratingCount >= 10000 ? 'compact' : 'standard' }).format(ratingCount) })})
            </Text>
          )}
        </View>
      )}
      {priceLevel !== null && priceLevel > 0 && (
        <Text variant="caption" color="textSecondary">
          {'€'.repeat(priceLevel)}
        </Text>
      )}
      {distance && (
        <Text variant="caption" color="textSecondary">
          {distance}
        </Text>
      )}
    </View>
  );
}

export function PlaceRow({ place, children }: { place: Place; children?: ReactNode }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        accessibilityRole="link"
        accessibilityHint={t('map.openInMaps')}
        onPress={() => openInMaps({ name: place.name, mapsUrl: place.mapsUrl, placeId: place.id, lat: place.lat, lng: place.lng })}
        style={styles.main}>
        <View style={styles.text}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {place.name}
          </Text>
          <PlaceMeta {...place} />
          {place.address && (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {place.address}
            </Text>
          )}
        </View>
        <Ionicons name="navigate-outline" size={20} color={colors.primary} />
      </Pressable>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  main: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  text: { flex: 1, gap: Spacing.xxs },
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing.md, rowGap: Spacing.xxs },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  bold: { fontWeight: '600' },
});
