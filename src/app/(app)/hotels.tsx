import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { PlacesMap } from '@/features/map/places-map';
import { openBookingLink, PlacesError, useHotels } from '@/features/places/api';
import { PlaceRow } from '@/features/places/place-row';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { useTrip } from '@/features/trips/queries';
import { formatDateRange } from '@/lib/format';
import { Spacing } from '@/theme/tokens';

/** Seyahatin bütçesine göre otel önerileri ve Booking.com bağlantıları. */
export default function HotelsScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const [destinationId, setDestinationId] = useState<string | null>(null);
  const hotels = useHotels(tripId, destinationId);
  const destinations = trip?.trip_destinations ?? [];
  const errorCode = hotels.error instanceof PlacesError ? hotels.error.code : hotels.error ? 'network' : null;
  const data = hotels.data;

  return (
    <Screen>
      <ModalHeader
        title={t('hotels.title')}
        subtitle={data ? `${data.city} · ${t(`budget.${data.budget}` as 'budget.mid')} · ${formatDateRange(data.checkin, data.checkout)}` : undefined}
      />

      {destinations.length > 1 && (
        <View style={styles.chips}>
          {destinations.map((d, i) => (
            <Chip
              key={d.id}
              icon="location-outline"
              label={d.city}
              selected={destinationId ? destinationId === d.id : i === 0}
              onPress={() => setDestinationId(d.id)}
            />
          ))}
        </View>
      )}

      {hotels.isLoading ? (
        <ActivityIndicator />
      ) : errorCode ? (
        <EmptyState icon="bed-outline" title={t('hotels.title')} description={t(`nearby.errors.${errorCode}`)}>
          {errorCode === 'quota_exceeded' && <UpgradeButton tripId={tripId} />}
          {errorCode !== 'quota_exceeded' && errorCode !== 'not_configured' && <Button title={t('common.retry')} variant="secondary" onPress={() => hotels.refetch()} />}
        </EmptyState>
      ) : !data || data.places.length === 0 ? (
        <EmptyState icon="bed-outline" title={t('hotels.title')} description={t('hotels.empty')} />
      ) : (
        <>
          <PlacesMap
            points={data.places
              .filter((p) => p.lat !== null && p.lng !== null)
              .map((p, i) => ({ id: p.id, lat: p.lat!, lng: p.lng!, title: p.name, label: String(i + 1) }))}
          />
          {data.places.map((p, i) => (
            <PlaceRow key={p.id} place={{ ...p, name: `${i + 1}. ${p.name}` }}>
              <Button title={t('hotels.viewOnBooking')} variant="secondary" onPress={() => openBookingLink(p.booking_url)} />
            </PlaceRow>
          ))}
          <Text variant="caption" color="textMuted">
            {t('hotels.disclosure')}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
