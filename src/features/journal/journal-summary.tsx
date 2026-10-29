import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatDayShort } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { usePhotoUrls, useJournal } from './api';
import { journalStats, MOOD_ICONS } from './logic';

/** Seyahat özetindeki anılar: gün gün not, ruh hali ve fotoğraflar (salt okunur); düzenleme günlük ekranında. */
export function JournalSummary({ tripId }: { tripId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: entries } = useJournal(tripId);
  const { data: urls } = usePhotoUrls((entries ?? []).flatMap((e) => e.photos));
  const stats = journalStats(entries ?? []);

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Ionicons name="book-outline" size={18} color={colors.primary} />
        <Text variant="subtitle" style={styles.flex}>
          {t('journal.summaryTitle')}
        </Text>
        {stats.days > 0 && (
          <Text variant="caption" color="textMuted">
            {t('journal.stats', { days: stats.days, photos: stats.photos })}{stats.places > 0 ? ` · ${t('journal.statsPlaces', { places: stats.places })}` : ''}
          </Text>
        )}
      </View>
      {(entries ?? []).map((e) => (
        <View key={e.id} style={styles.entry}>
          <View style={styles.row}>
            {e.mood && <Ionicons name={MOOD_ICONS[e.mood]} size={18} color={colors.primary} />}
            <Text variant="bodyStrong">{formatDayShort(e.entry_date)}</Text>
          </View>
          {e.note ? <Text variant="body">{e.note}</Text> : null}
          {e.places.length > 0 && (
            <Text variant="caption" color="textSecondary">
              {e.places.join(' · ')}
            </Text>
          )}
          {e.photos.length > 0 && (
            <View style={styles.photos}>
              {e.photos.map((p) => (
                <View key={p} style={[styles.photo, { backgroundColor: colors.border }]}>
                  {urls?.get(p) ? <Image source={{ uri: urls.get(p) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('journal.photo')} /> : null}
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
      {stats.days === 0 && (
        <Text variant="caption" color="textSecondary">
          {t('journal.empty')}
        </Text>
      )}
      <Button
        title={stats.days === 0 ? t('journal.start') : t('journal.edit')}
        variant="secondary"
        onPress={() => router.push({ pathname: '/trip-journal', params: { tripId } })}
      />
      <Text variant="caption" color="textMuted">
        {t('journal.private')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  entry: { gap: Spacing.xs },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo: { width: 88, height: 88, borderRadius: Radius.md, overflow: 'hidden' },
});
