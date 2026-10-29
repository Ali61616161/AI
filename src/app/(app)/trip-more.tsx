import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DirIcon } from '@/components/ui/dir-icon';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { EsimCard } from '@/features/esim/esim-card';
import { OfflineCard } from '@/features/offline/offline-card';
import { ShareSection } from '@/features/sharing/share-section';
import { ReservationRow } from '@/features/trips/reservation-row';
import { useActivePlan, useDeleteTrip, useLeaveTrip, useTrip } from '@/features/trips/queries';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Row = { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void };

/**
 * Seyahat ayarları ("⋯"): ana ekranda gerekli olmayan, ama lazım olunca bulunacak şeyler. Tarihleri değiştir, plan geçmişi,
 * oteller, fiyat takibi, eSIM, çevrimdışı kullanım, rezervasyon listesi, paylaşım ve silme.
 */
export default function TripMoreScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip, isLoading } = useTrip(tripId);
  const { data: plan } = useActivePlan(tripId);
  const deleteTrip = useDeleteTrip();
  const leaveTrip = useLeaveTrip();
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);

  if (isLoading) {
    return (
      <Screen>
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }
  if (!trip) {
    return (
      <Screen>
        <ModalHeader title={t('trip.more')} />
        <EmptyState icon="alert-circle-outline" title={t('trip.notFound')} description={t('trips.loadFailed')} />
      </Screen>
    );
  }

  const readOnly = trip.owner_id !== userId;
  const rows: Row[] = readOnly
    ? []
    : [
        { icon: 'calendar-outline', label: t('trip.changeDates'), onPress: () => router.push({ pathname: '/trip-dates', params: { tripId: trip.id } }) },
        ...(plan ? [{ icon: 'git-branch-outline' as const, label: t('trip.versions'), onPress: () => router.push({ pathname: '/trip-versions', params: { tripId: trip.id } }) }] : []),
        { icon: 'bed-outline', label: t('hotels.button'), onPress: () => router.push({ pathname: '/hotels', params: { tripId: trip.id } }) },
        { icon: 'pricetag-outline', label: t('priceWatch.title'), onPress: () => router.push('/price-watch') },
      ];

  return (
    <Screen>
      <ModalHeader title={t('trip.more')} subtitle={trip.title} />

      {rows.length > 0 && (
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map((r) => (
            <Tap key={r.label} accessibilityRole="button" accessibilityLabel={r.label} onPress={r.onPress} feedback="select">
              <View style={styles.listRow}>
                <Ionicons name={r.icon} size={20} color={colors.primary} />
                <Text variant="bodyStrong" style={styles.flex}>
                  {r.label}
                </Text>
                <DirIcon name="chevron-forward" size={18} color={colors.textSecondary} />
              </View>
            </Tap>
          ))}
        </View>
      )}

      <EsimCard countryCodes={trip.trip_destinations.map((d) => d.country_code)} />
      <OfflineCard tripId={trip.id} countryCode={trip.trip_destinations[0]?.country_code ?? null} />

      {trip.reservations.length > 0 && (
        <View style={styles.section}>
          <Text variant="subtitle">
            {t('plan.showReservations')} · {trip.reservations.length}
          </Text>
          {trip.reservations.map((r) => (
            <ReservationRow key={r.id} reservation={r} />
          ))}
        </View>
      )}

      {!readOnly && <ShareSection tripId={trip.id} tripTitle={trip.title} />}

      {readOnly ? (
        <Button
          title={t('share.leave')}
          variant="ghost"
          loading={leaveTrip.isPending}
          onPress={() =>
            Alert.alert(t('share.leave'), t('share.leaveBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('share.leave'), style: 'destructive', onPress: () => leaveTrip.mutate(trip.id, { onSuccess: () => router.replace('/trips') }) },
            ])
          }
        />
      ) : (
        <Button
          title={t('trip.delete')}
          variant="ghost"
          loading={deleteTrip.isPending}
          onPress={() =>
            Alert.alert(t('trip.deleteTitle', { title: trip.title }), t('trip.deleteBody'), [
              { text: t('common.cancel'), style: 'cancel' },
              { text: t('trip.delete'), style: 'destructive', onPress: () => deleteTrip.mutate(trip.id, { onSuccess: () => router.replace('/trips') }) },
            ])
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  flex: { flex: 1 },
  section: { gap: Spacing.md },
});
