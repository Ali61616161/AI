import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { RESERVATION_ICONS, TRANSPORT_TYPES } from '@/features/documents/reservation-icons';
import { useOfflineStore, type OfflineFile } from '@/features/offline/offline-store';
import { useTrip, type TripReservation } from '@/features/trips/queries';
import { formatLocalDateTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const NO_FILES: never[] = [];

const routeOf = (r: TripReservation) => (TRANSPORT_TYPES.includes(r.type) ? [r.origin_code ?? r.origin_name, r.destination_code ?? r.destination_name].filter(Boolean).join(' → ') : r.address);

/**
 * Cüzdan: seyahatin bilet ve rezervasyonları tek yerde. Karta dokununca kod ve saatler gişede
 * gösterilecek büyüklükte açılır; internetsiz kaydedilen belgeler (QR'lı biletler) altta durur.
 */
export default function WalletScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const files = useOfflineStore((s) => s.trips[tripId]?.files ?? NO_FILES);
  const [shown, setShown] = useState<TripReservation | null>(null);
  const [image, setImage] = useState<OfflineFile | null>(null);
  const [copied, setCopied] = useState(false);

  const reservations = [...(trip?.reservations ?? [])].sort((a, b) => a.starts_at.localeCompare(b.starts_at));

  function openFile(file: OfflineFile) {
    if (file.mimeType.startsWith('image/')) setImage(file);
    // PDF'ler telefonun kendi görüntüleyicisinde açılır (internetsiz de çalışır).
    else Sharing.shareAsync(file.uri, { mimeType: file.mimeType, UTI: 'com.adobe.pdf' }).catch(() => undefined);
  }

  async function copy(code: string) {
    await Clipboard.setStringAsync(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Screen>
      <ModalHeader title={t('wallet.title')} subtitle={trip?.title ?? t('wallet.subtitle')} />

      {reservations.length === 0 && files.length === 0 ? (
        <EmptyState icon="wallet-outline" title={t('wallet.emptyTitle')} description={t('wallet.emptyBody')} />
      ) : null}

      {reservations.map((r) => (
        <Pressable key={r.id} accessibilityRole="button" accessibilityHint={t('wallet.showHint')} onPress={() => setShown(r)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name={RESERVATION_ICONS[r.type]} size={22} color={colors.primary} />
          </View>
          <View style={styles.flex}>
            <Text variant="caption" color="textMuted">
              {formatLocalDateTime(r.starts_at, r.start_timezone)}
            </Text>
            <Text variant="bodyStrong" numberOfLines={2}>
              {r.title}
            </Text>
            {routeOf(r) ? (
              <Text variant="caption" color="textSecondary" numberOfLines={1}>
                {routeOf(r)}
              </Text>
            ) : null}
          </View>
          {r.reference_code && (
            <View style={[styles.code, { backgroundColor: colors.surfaceMuted }]}>
              <Text variant="caption" style={styles.mono}>
                {r.reference_code}
              </Text>
            </View>
          )}
        </Pressable>
      ))}

      {files.length > 0 && (
        <View style={styles.section}>
          <Text variant="subtitle">{t('wallet.documents')}</Text>
          {files.map((f) => (
            <Pressable key={f.documentId} accessibilityRole="button" onPress={() => openFile(f)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={f.mimeType.startsWith('image/') ? 'qr-code-outline' : 'document-text-outline'} size={22} color={colors.primary} />
              <Text variant="bodyStrong" style={styles.flex}>
                {f.title}
              </Text>
              <Ionicons name="open-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          ))}
          <Text variant="caption" color="textMuted">
            {t('wallet.offlineHint')}
          </Text>
        </View>
      )}

      <Modal visible={shown !== null} animationType="fade" onRequestClose={() => setShown(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setShown(null)} style={[styles.full, { backgroundColor: colors.background }]}>
          {shown && (
            <>
              <Ionicons name={RESERVATION_ICONS[shown.type]} size={40} color={colors.primary} style={styles.center} />
              <Text variant="title" style={styles.center}>
                {shown.title}
              </Text>
              {shown.provider_name && (
                <Text variant="body" color="textSecondary" style={styles.center}>
                  {shown.provider_name}
                </Text>
              )}
              {shown.reference_code && (
                <Pressable accessibilityRole="button" accessibilityLabel={t('wallet.copy')} onPress={() => copy(shown.reference_code!)}>
                  <Text variant="display" style={[styles.center, styles.big, styles.mono]}>
                    {shown.reference_code}
                  </Text>
                  <Text variant="caption" color="textMuted" style={styles.center}>
                    {copied ? t('wallet.copied') : t('wallet.copy')}
                  </Text>
                </Pressable>
              )}
              {routeOf(shown) ? (
                <Text variant="subtitle" style={styles.center}>
                  {routeOf(shown)}
                </Text>
              ) : null}
              <Text variant="body" color="textSecondary" style={styles.center}>
                {formatLocalDateTime(shown.starts_at, shown.start_timezone)}
                {shown.ends_at ? ` – ${formatLocalDateTime(shown.ends_at, shown.end_timezone ?? shown.start_timezone)}` : ''}
              </Text>
              <Text variant="caption" color="textMuted" style={styles.center}>
                {t('phrases.tapToClose')}
              </Text>
            </>
          )}
        </Pressable>
      </Modal>

      <Modal visible={image !== null} animationType="fade" onRequestClose={() => setImage(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setImage(null)} style={[styles.full, { backgroundColor: '#FFFFFF' }]}>
          {image && <Image source={{ uri: image.uri }} contentFit="contain" style={styles.photo} accessibilityLabel={image.title} />}
          <Text variant="caption" style={[styles.center, styles.dark]}>
            {t('wallet.brightnessHint')}
          </Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: Spacing.xxs },
  card: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 44, height: 44, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  code: { paddingHorizontal: Spacing.sm, paddingVertical: Spacing.xs, borderRadius: Radius.md },
  mono: { fontVariant: ['tabular-nums'], letterSpacing: 1.5 },
  section: { gap: Spacing.sm },
  full: { flex: 1, justifyContent: 'center', gap: Spacing.lg, padding: Spacing.xl },
  center: { textAlign: 'center', alignSelf: 'center' },
  big: { fontSize: 52, lineHeight: 62 },
  photo: { flex: 1, width: '100%' },
  dark: { color: '#0B1220' },
});
