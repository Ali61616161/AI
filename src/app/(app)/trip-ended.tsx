import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { IconBadge } from '@/components/ui/icon-badge';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Stars } from '@/features/report/stars';
import { useTrip } from '@/features/trips/queries';
import { Spacing } from '@/theme/tokens';

/** Seyahat bitince bir kez çıkan pencere: genel puan ver ve seyahat raporunu oluştur. */
export default function TripEndedScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const [rating, setRating] = useState<number | null>(null);
  const title = trip?.title ?? '';

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('report.promptCreate')}
            onPress={() => router.replace({ pathname: '/trip-report', params: { tripId, ...(rating ? { overall: String(rating) } : {}) } })}
          />
          <Button title={t('report.promptLater')} variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <View style={styles.center}>
        <IconBadge icon="trophy" tone="gradient" size={72} />
        <Text variant="display" style={styles.text}>
          {t('report.promptTitle')}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.text}>
          {t('report.promptSubtitle', { trip: title })}
        </Text>
        <Stars value={rating} onChange={setRating} size={42} label={t('report.promptRate', { trip: title })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', gap: Spacing.lg, paddingTop: Spacing.xxl },
  text: { textAlign: 'center' },
});
