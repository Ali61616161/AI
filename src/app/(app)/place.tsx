import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { openBookingLink, openInGoogleMaps, openInMaps, PlacesError } from '@/features/places/api';
import { usePlaceCard } from '@/features/places/place-card-api';
import { PlaceMeta } from '@/features/places/place-row';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { Radius, Spacing } from '@/theme/tokens';
import { formatMoney } from '@/lib/format';
import { useTheme } from '@/theme/use-theme';

/** Mekân kartı: Google fotoğrafları, puan, çalışma saatleri, adres ve yol tarifi. */
export default function PlaceScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const p = useLocalSearchParams<{ id: string; name?: string; address?: string; lat?: string; lng?: string; mapsUrl?: string }>();
  const { data, isPending, error } = usePlaceCard(p.id);

  // Yüklenirken ve hata durumunda ekrana gelen bilgilerle çalışmaya devam edilir.
  const name = data?.name ?? p.name ?? '';
  const address = data?.address ?? p.address ?? null;
  const lat = data?.lat ?? (p.lat ? Number(p.lat) : null);
  const lng = data?.lng ?? (p.lng ? Number(p.lng) : null);
  const mapsUrl = data?.mapsUrl ?? p.mapsUrl ?? null;
  const photoWidth = width - Spacing.lg * 2;
  const todayIndex = (new Date().getDay() + 6) % 7; // Google saatleri Pazartesi'den başlar.

  return (
    <Screen>
      <ModalHeader title={name} subtitle={data?.typeLabel ?? undefined} />

      {data && data.photos.length > 0 ? (
        <View>
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={styles.photos}>
            {data.photos.map((photo) => (
              <View key={photo.uri} style={{ width: photoWidth }}>
                <Image source={{ uri: photo.uri }} contentFit="cover" transition={200} accessibilityIgnoresInvertColors style={[styles.photo, { width: photoWidth, backgroundColor: colors.surfaceMuted }]} />
                {photo.author && (
                  <Text variant="caption" color="textMuted" style={styles.credit} numberOfLines={1}>
                    {t('place.photoBy', { name: photo.author })}
                  </Text>
                )}
              </View>
            ))}
          </ScrollView>
        </View>
      ) : isPending ? (
        <View style={[styles.photo, styles.loading, { backgroundColor: colors.surfaceMuted }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}

      <View style={styles.block}>
        {data && <PlaceMeta rating={data.rating} ratingCount={data.ratingCount} priceLevel={data.priceLevel} distanceM={null} />}
        {data?.priceRange && (
          <View style={styles.row}>
            <Ionicons name="wallet-outline" size={16} color={colors.textMuted} />
            <Text variant="caption" color="textSecondary" style={styles.flex}>
              {t('place.priceRange', { range: [data.priceRange.min, data.priceRange.max].filter((v, i, a) => v !== null && a.indexOf(v) === i).map((v) => formatMoney(v as number, data.priceRange!.currency)).join(' – ') })}
            </Text>
          </View>
        )}
        {data?.openNow != null && (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: data.openNow ? colors.success : colors.danger }]} />
            <Text variant="caption" color={data.openNow ? 'success' : 'danger'}>
              {data.openNow ? t('place.open') : t('place.closed')}
            </Text>
          </View>
        )}
        {address && (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={16} color={colors.textMuted} />
            <Text variant="body" color="textSecondary" style={styles.flex}>
              {address}
            </Text>
          </View>
        )}
        {data?.summary && <Text variant="body">{data.summary}</Text>}
      </View>

      {error && (
        <Card variant="solid" padding={Spacing.md}>
          <Text variant="caption" color={error instanceof PlacesError && error.code === 'quota_exceeded' ? 'warning' : 'textSecondary'}>
            {error instanceof PlacesError && error.code === 'quota_exceeded' ? t('place.quotaReached') : t('place.loadError')}
          </Text>
          {error instanceof PlacesError && error.code === 'quota_exceeded' && <UpgradeButton />}
        </Card>
      )}

      <View style={styles.actions}>
        <Button
          title={t('place.directions')}
          icon="git-branch-outline"
          onPress={() =>
            router.push({
              pathname: '/route',
              params: { ...(lat !== null && lng !== null ? { toLat: String(lat), toLng: String(lng) } : {}), toName: [name, lat === null ? address : null].filter(Boolean).join(', ') },
            })
          }
        />
        <View style={styles.rowButtons}>
          <Button title={t('map.showOnMap')} variant="secondary" icon="map-outline" onPress={() => openInMaps({ name, mapsUrl, placeId: p.id, lat, lng, address })} style={styles.flex} />
          {data?.website && <Button title={t('place.website')} variant="secondary" icon="globe-outline" onPress={() => openBookingLink(data.website!)} style={styles.flex} />}
          {data?.phone && <Button title={t('place.call')} variant="secondary" icon="call-outline" onPress={() => Linking.openURL(`tel:${data.phone!.replace(/[^\d+]/g, '')}`)} style={styles.flex} />}
        </View>
      </View>

      <Button title={t('place.googleMaps')} variant="ghost" icon="open-outline" onPress={() => openInGoogleMaps({ name, mapsUrl, placeId: p.id, lat, lng })} />

      {data && data.hours.length > 0 && (
        <Card variant="solid" padding={Spacing.md}>
          <Text variant="overline" color="textMuted" style={styles.hoursTitle}>
            {t('place.hours')}
          </Text>
          {data.hours.map((line, i) => (
            <Text key={line} variant="caption" color={i === todayIndex ? 'primary' : 'textSecondary'} style={i === todayIndex ? styles.today : undefined}>
              {line}
            </Text>
          ))}
        </Card>
      )}

      {data && (
        <Text variant="caption" color="textMuted" style={styles.attribution}>
          {t('place.poweredBy')}
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photos: { marginHorizontal: 0 },
  photo: { height: 220, borderRadius: Radius.xl },
  loading: { alignItems: 'center', justifyContent: 'center' },
  credit: { marginTop: Spacing.xs },
  block: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  rowButtons: { flexDirection: 'row', gap: Spacing.sm },
  flex: { flex: 1 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { gap: Spacing.sm },
  hoursTitle: { marginBottom: Spacing.xs },
  today: { fontWeight: '700' },
  attribution: { textAlign: 'center' },
});
