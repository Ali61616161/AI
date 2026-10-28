import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useOfflineStore, type OfflineFile } from '@/features/offline/offline-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const NO_FILES: never[] = [];

/** Çevrimdışı indirilmiş biletler ve rezervasyon belgeleri. */
export default function TripDocumentsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const files = useOfflineStore((s) => s.trips[tripId]?.files ?? NO_FILES);
  const [open, setOpen] = useState<OfflineFile | null>(null);

  function show(file: OfflineFile) {
    if (file.mimeType.startsWith('image/')) setOpen(open?.documentId === file.documentId ? null : file);
    // PDF'ler telefonun kendi görüntüleyicisinde açılır (internetsiz de çalışır).
    else Sharing.shareAsync(file.uri, { mimeType: file.mimeType, UTI: file.mimeType === 'text/plain' ? 'public.plain-text' : 'com.adobe.pdf' }).catch(() => undefined);
  }

  return (
    <Screen>
      <ModalHeader title={t('offline.documents')} subtitle={t('offline.documentsSubtitle')} />
      {files.length === 0 ? (
        <EmptyState icon="document-outline" title={t('offline.documents')} description={t('offline.noDocuments')} />
      ) : (
        files.map((f) => (
          <View key={f.documentId} style={styles.block}>
            <Pressable
              accessibilityRole="button"
              onPress={() => show(f)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={f.mimeType.startsWith('image/') ? 'image-outline' : 'document-text-outline'} size={22} color={colors.primary} />
              <Text variant="bodyStrong" style={styles.flex}>
                {f.title}
              </Text>
              <Ionicons name={f.mimeType.startsWith('image/') ? 'chevron-down' : 'open-outline'} size={18} color={colors.textSecondary} />
            </Pressable>
            {open?.documentId === f.documentId && (
              <Image source={{ uri: f.uri }} contentFit="contain" style={[styles.image, { backgroundColor: colors.surfaceMuted }]} accessibilityLabel={f.title} />
            )}
          </View>
        ))
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  flex: { flex: 1 },
  image: { width: '100%', aspectRatio: 0.7, borderRadius: Radius.lg },
});
