import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { LiveMap } from '@/features/live/live-map';
import { openInGoogleMaps } from '@/features/places/api';
import { openPlaceCard } from '@/features/places/place-card-api';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const BOTTOM_AREA = 230;

/** Tek mekânın uygulama içi haritası: Google Haritalar'a çıkmadan yer, yol tarifi ve ayrıntılar. */
export default function PlaceMapScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const p = useLocalSearchParams<{ name?: string; lat?: string; lng?: string; id?: string; address?: string; mapsUrl?: string }>();
  const lat = Number(p.lat);
  const lng = Number(p.lng);
  const name = p.name ?? '';
  const valid = Number.isFinite(lat) && Number.isFinite(lng) && Boolean(p.lat) && Boolean(p.lng);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {valid && <LiveMap points={[{ id: 'place', lat, lng, title: name, label: '•' }]} selectedId="place" onSelect={() => {}} topInset={insets.top + 64} bottomInset={BOTTOM_AREA + insets.bottom} />}

      <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
        <Tap accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => router.back()} hitSlop={12} feedback="press">
          <View style={[styles.close, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="close" size={20} color={colors.text} />
          </View>
        </Tap>
      </View>

      <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md }]} pointerEvents="box-none">
        <Card variant="glow" padding={Spacing.lg}>
          <View style={styles.gap}>
            <Text variant="subtitle" numberOfLines={2}>
              {name}
            </Text>
            {p.address && (
              <Text variant="caption" color="textSecondary" numberOfLines={2}>
                {p.address}
              </Text>
            )}
            <Button
              title={t('place.directions')}
              icon="git-branch-outline"
              onPress={() => router.push({ pathname: '/route', params: { toLat: String(lat), toLng: String(lng), toName: name } })}
            />
            <View style={styles.row}>
              {p.id && <Button title={t('place.details')} variant="secondary" icon="images-outline" onPress={() => openPlaceCard({ id: p.id!, name, address: p.address, lat, lng, mapsUrl: p.mapsUrl })} style={styles.flex} />}
              <Button title={t('place.googleMaps')} variant="ghost" icon="open-outline" onPress={() => openInGoogleMaps({ name, mapsUrl: p.mapsUrl, placeId: p.id, lat, lng })} style={styles.flex} />
            </View>
          </View>
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg },
  close: { width: 40, height: 40, borderRadius: Radius.pill, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: Spacing.lg },
  gap: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
});
