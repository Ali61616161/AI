import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ScanThumbnail } from '@/features/documents/scan-thumbnail';
import { pickDocuments, pickFromCamera, pickFromLibrary, UploadError, type LocalFile } from '@/features/documents/upload';
import { useUploadStore, type UploadEntry } from '@/features/documents/upload-store';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Source = { key: 'sourceCamera' | 'sourceLibrary' | 'sourceFile'; icon: ComponentProps<typeof Ionicons>['name']; pick: () => Promise<LocalFile[]> };

const SOURCES: Source[] = [
  { key: 'sourceCamera', icon: 'camera-outline', pick: pickFromCamera },
  { key: 'sourceLibrary', icon: 'images-outline', pick: pickFromLibrary },
  { key: 'sourceFile', icon: 'document-attach-outline', pick: pickDocuments },
];

function EntryRow({ entry, onRetry, onRemove }: { entry: UploadEntry; onRetry: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const itemCount = useUploadStore((s) => s.items.filter((i) => i.documentId === entry.documentId).length);
  const busy = entry.status === 'uploading' || entry.status === 'reading';

  const status = {
    queued: t('ticket.statusQueued'),
    uploading: t('ticket.statusUploading'),
    reading: t('ticket.statusReading'),
    done: t('ticket.statusDone', { count: itemCount }),
    failed: entry.errorCode ? t(`ticket.errors.${entry.errorCode}`) : t('ticket.statusFailed'),
  }[entry.status];
  const statusColor = entry.status === 'failed' ? 'danger' : entry.status === 'done' ? 'success' : 'textSecondary';

  return (
    <View style={[styles.entry, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <ScanThumbnail uri={entry.file.uri} mimeType={entry.file.mimeType} scanning={entry.status === 'reading'} />
      <View style={styles.entryText}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {entry.file.name}
        </Text>
        <Text variant="caption" color={statusColor}>
          {status}
        </Text>
      </View>
      {entry.status === 'failed' && entry.errorCode !== 'unsupported_file' && entry.errorCode !== 'file_too_large' && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.retry')} onPress={onRetry} hitSlop={8}>
          <Ionicons name="refresh" size={22} color={colors.primary} />
        </Pressable>
      )}
      {!busy && (
        <Pressable accessibilityRole="button" accessibilityLabel={t('ticket.remove')} onPress={onRemove} hitSlop={8}>
          <Ionicons name="close-circle" size={22} color={colors.textMuted} />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Bilet ve otel yükleme. Belgeler kullanıcının storage klasörüne yüklenir,
 * parse-document fonksiyonu Gemini ile okur, sonuç inceleme ekranında onaylanır.
 * `tripId` parametresi verilirse onaylanan kalemler o seyahate eklenir.
 */
export default function TicketScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const session = useSessionStore((s) => s.session);
  const { entries, items, addFiles, processAll, retry, remove, reset } = useUploadStore();
  const [pickError, setPickError] = useState<string | null>(null);

  // Akış kapanınca (seyahat oluşturuldu veya vazgeçildi) seçilen belgeleri temizle.
  useEffect(() => reset, [reset]);

  const configured = isSupabaseConfigured();
  const busy = entries.some((e) => e.status === 'uploading' || e.status === 'reading');
  const queued = entries.some((e) => e.status === 'queued');

  async function pick(source: Source) {
    setPickError(null);
    try {
      const files = await source.pick();
      if (files.length) addFiles(files);
    } catch (e) {
      setPickError(t(`ticket.errors.${e instanceof UploadError ? e.code : 'network'}`));
    }
  }

  const footer = (
    <>
      {items.length > 0 && !busy && (
        <Button
          title={t('ticket.review')}
          onPress={() => router.push({ pathname: '/ticket-review', params: tripId ? { tripId } : {} })}
        />
      )}
      {queued && (
        <Button
          title={t('ticket.read')}
          variant={items.length > 0 ? 'secondary' : 'primary'}
          loading={busy}
          disabled={!session || !configured}
          onPress={() => session && processAll(session.user.id)}
        />
      )}
    </>
  );

  return (
    <Screen footer={footer}>
      <ModalHeader title={t('ticket.title')} subtitle={t('ticket.subtitle')} />

      {!configured ? (
        <EmptyState icon="cloud-offline-outline" title={t('ticket.serverMissingTitle')} description={t('ticket.serverMissingBody')} />
      ) : !session ? (
        <EmptyState icon="person-circle-outline" title={t('ticket.accountRequiredTitle')} description={t('ticket.accountRequiredBody')}>
          <Button title={t('profile.createAccount')} onPress={() => router.push('/sign-in')} />
        </EmptyState>
      ) : null}

      <View style={styles.sources}>
        {SOURCES.map((s) => (
          <Pressable
            key={s.key}
            accessibilityRole="button"
            onPress={() => pick(s)}
            disabled={busy}
            style={({ pressed }) => [
              styles.source,
              { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed || busy ? 0.7 : 1 },
            ]}>
            <Ionicons name={s.icon} size={26} color={colors.primary} />
            <Text variant="caption" style={styles.center}>
              {t(`ticket.${s.key}`)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text variant="caption" color="textMuted" style={styles.center}>
        {t('ticket.supported')}
      </Text>
      {pickError && (
        <Text variant="caption" color="danger" style={styles.center}>
          {pickError}
        </Text>
      )}

      {entries.length > 0 && (
        <View style={styles.list}>
          <Text variant="subtitle">{t('ticket.selected')}</Text>
          {entries.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onRetry={() => session && retry(entry.id, session.user.id)}
              onRemove={() => remove(entry.id)}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  sources: { flexDirection: 'row', gap: Spacing.sm },
  source: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.sm,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  center: { textAlign: 'center' },
  list: { gap: Spacing.md },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  entryText: { flex: 1, gap: Spacing.xxs },
});
