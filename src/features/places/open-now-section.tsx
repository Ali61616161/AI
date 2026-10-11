import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { getCurrentLocation } from '@/features/plan/replan';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { Spacing } from '@/theme/tokens';

import { NEARBY_CATEGORY_LIST, PlacesError, useOpenNow, type NearbyCategory } from './api';
import { PlaceRow } from './place-row';

const MAX_ROWS = 5;

/** Bugün ekranı: konuma yakın, şu an açık yerler (kategoriye göre). */
export function OpenNowSection() {
  const { t } = useTranslation();
  const [category, setCategory] = useState<NearbyCategory>('restaurant');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [denied, setDenied] = useState(false);
  const query = useOpenNow(category, coords);

  // İzin daha önce verildiyse sormadan konumu al.
  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then(async (p) => {
        if (!p.granted || cancelled) return;
        const c = await getCurrentLocation();
        if (!cancelled && c) setCoords(c);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  async function locate() {
    setLocating(true);
    const c = await getCurrentLocation();
    setLocating(false);
    setDenied(!c);
    if (c) setCoords(c);
  }

  const errorCode = query.error instanceof PlacesError ? query.error.code : query.error ? 'network' : null;

  return (
    <View style={styles.section}>
      <Text variant="subtitle">{t('nearby.title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {NEARBY_CATEGORY_LIST.map((c) => (
          <Chip key={c.key} icon={c.icon} label={t(`nearby.categories.${c.key}`)} selected={c.key === category} onPress={() => setCategory(c.key)} />
        ))}
      </ScrollView>

      {!coords ? (
        <View style={styles.gap}>
          {denied && (
            <Text variant="caption" color="warning">
              {t('nearby.locationDenied')}
            </Text>
          )}
          <Button title={t('nearby.useLocation')} variant="secondary" loading={locating} onPress={locate} />
        </View>
      ) : query.isLoading ? (
        <ActivityIndicator />
      ) : errorCode ? (
        <View style={styles.gap}>
          <Text variant="caption" color={errorCode === 'quota_exceeded' ? 'warning' : 'danger'}>
            {t(`nearby.errors.${errorCode}`)}
          </Text>
          {errorCode === 'quota_exceeded' && <UpgradeButton />}
          {errorCode !== 'quota_exceeded' && errorCode !== 'not_configured' && <Button title={t('common.retry')} variant="ghost" onPress={() => query.refetch()} />}
        </View>
      ) : query.data && query.data.length === 0 ? (
        <Text variant="body" color="textMuted">
          {t('nearby.empty')}
        </Text>
      ) : (
        query.data?.slice(0, MAX_ROWS).map((p) => <PlaceRow key={p.id} place={p} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  chips: { gap: Spacing.sm },
  gap: { gap: Spacing.sm },
});
