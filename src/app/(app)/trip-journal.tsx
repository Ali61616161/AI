import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useJournal } from '@/features/journal/api';
import { JournalDay } from '@/features/journal/journal-day';
import { journalDays } from '@/features/journal/logic';
import { useTrip } from '@/features/trips/queries';
import { todayIsoDate } from '@/lib/format';
import { Spacing } from '@/theme/tokens';

/** Seyahat günlüğü: her gün için not, ruh hali ve fotoğraf. En yeni gün üstte. */
export default function TripJournalScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: entries, isLoading } = useJournal(tripId);
  const days = trip ? journalDays(trip.start_date, trip.end_date, todayIsoDate()).reverse() : [];

  return (
    <Screen>
      <ModalHeader title={t('journal.title')} subtitle={trip?.title} />
      <Text variant="caption" color="textSecondary">
        {t('journal.private')}
      </Text>
      {isLoading || !trip ? (
        <ActivityIndicator />
      ) : days.length === 0 ? (
        <Text variant="body" color="textSecondary">
          {t('journal.notStarted')}
        </Text>
      ) : (
        <View style={styles.list}>
          {days.map((date) => (
            <JournalDay key={date} tripId={tripId} date={date} entry={entries?.find((e) => e.entry_date === date)} />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: Spacing.md } });
