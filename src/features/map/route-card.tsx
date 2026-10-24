import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { isHttpsUrl } from '@/lib/safe-url';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { PlacesMapProps } from './types';

/**
 * Yerel harita kullanılamadığında (web, anahtarsız Android) durakları sırasıyla
 * Google Haritalar'da yol tarifi olarak açan kart.
 */
export function RouteCard({ points }: PlacesMapProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (points.length === 0) return null;

  const coords = points.map((p) => `${p.lat},${p.lng}`);
  const url =
    points.length === 1
      ? `https://www.google.com/maps/search/?api=1&query=${coords[0]}`
      : `https://www.google.com/maps/dir/?api=1&origin=${coords[0]}&destination=${coords[coords.length - 1]}` +
        (coords.length > 2 ? `&waypoints=${encodeURIComponent(coords.slice(1, -1).slice(0, 8).join('|'))}` : '');

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => isHttpsUrl(url) && Linking.openURL(url)}
      style={[styles.card, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.surface }]}>
        <Ionicons name="map-outline" size={22} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <Text variant="bodyStrong">{t('map.openRoute')}</Text>
        <Text variant="caption" color="textSecondary" numberOfLines={2}>
          {points.map((p) => p.title).join(' → ')}
        </Text>
      </View>
      <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 40, height: 40, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.xxs },
});
