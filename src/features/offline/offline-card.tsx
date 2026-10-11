import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { canDownloadFiles, downloadTripForOffline } from './download';
import { useOfflineStore } from './offline-store';
import { useIsOnline } from './use-online';

/** Seyahat detayında: rotayı, belgeleri ve hava tahminini telefona indir. */
export function OfflineCard({ tripId, countryCode }: { tripId: string; countryCode: string | null }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const online = useIsOnline();
  const saved = useOfflineStore((s) => s.trips[tripId]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [failed, setFailed] = useState(false);

  async function download() {
    setFailed(false);
    setProgress({ done: 0, total: 0 });
    try {
      await downloadTripForOffline(tripId, (done, total) => setProgress({ done, total }));
    } catch (e) {
      console.warn('offline download failed', e);
      setFailed(true);
    } finally {
      setProgress(null);
    }
  }

  const when = saved ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(saved.downloadedAt)) : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.header}>
        <Ionicons name={saved ? 'cloud-done-outline' : 'cloud-download-outline'} size={22} color={saved ? colors.success : colors.primary} />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{saved ? t('offline.ready') : t('offline.title')}</Text>
          <Text variant="caption" color="textSecondary">
            {saved
              ? t('offline.savedAt', { date: when, count: saved.files.length })
              : canDownloadFiles
                ? t('offline.description')
                : t('offline.descriptionWeb')}
          </Text>
        </View>
      </View>
      {failed && (
        <Text variant="caption" color="danger">
          {t('offline.failed')}
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          title={progress ? (progress.total ? t('offline.downloading', { done: progress.done, total: progress.total }) : t('common.loading')) : saved ? t('offline.update') : t('offline.download')}
          variant={saved ? 'ghost' : 'secondary'}
          loading={Boolean(progress)}
          disabled={!online}
          onPress={download}
          style={styles.flex}
        />
        {saved && saved.files.length > 0 && (
          <Button title={t('offline.documents')} variant="secondary" onPress={() => router.push({ pathname: '/trip-documents', params: { tripId } })} style={styles.flex} />
        )}
      </View>
      <Button title={t('phrases.title')} variant="ghost" onPress={() => router.push({ pathname: '/phrases', params: { country: countryCode ?? '' } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  header: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
});
