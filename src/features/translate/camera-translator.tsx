import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useTranslateImage } from './api';
import { translateErrorKey } from './error-text';
import { LanguagePicker } from './language-picker';
import { translateLanguage } from './languages';
import { QuotaNote } from './quota-note';

/** Fotoğrafı küçültüp JPEG base64'e çevirir (yükleme süresi ve AI maliyeti için). */
async function prepare(uri: string): Promise<{ base64: string; uri: string }> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  return { base64: saved.base64!, uri: saved.uri };
}

/** Kamerayla menü, tabela veya bilet çevirisi (Gemini görsel okuma). */
export function CameraTranslator({ myLanguage, onLanguage }: { myLanguage: string; onLanguage: (code: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const translate = useTranslateImage();
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  async function pick(source: 'camera' | 'library') {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return;
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.9 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    setPreparing(true);
    try {
      const image = await prepare(result.assets[0].uri);
      setPreview(image.uri);
      translate.mutate({ base64: image.base64, mimeType: 'image/jpeg', target: myLanguage });
    } finally {
      setPreparing(false);
    }
  }

  const data = translate.data;
  const sections = data ? [...new Set(data.items.map((i) => i.section ?? ''))] : [];

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Text variant="body" color="textSecondary">
          {t('translate.translateInto')}
        </Text>
        <LanguagePicker label={t('translate.to')} value={myLanguage} onChange={onLanguage} />
      </View>
      <View style={styles.row}>
        <Button title={t('translate.takePhoto')} onPress={() => pick('camera')} disabled={translate.isPending || preparing} style={styles.flex} />
        <Button title={t('translate.choosePhoto')} variant="secondary" onPress={() => pick('library')} disabled={translate.isPending || preparing} style={styles.flex} />
      </View>
      <QuotaNote feature="menu_scan" />

      {preview && <Image source={{ uri: preview }} contentFit="cover" style={[styles.preview, { backgroundColor: colors.surfaceMuted }]} accessibilityIgnoresInvertColors />}

      {(translate.isPending || preparing) && (
        <View style={styles.row}>
          <ActivityIndicator color={colors.primary} />
          <Text variant="body" color="textSecondary">
            {t('translate.reading')}
          </Text>
        </View>
      )}
      {translate.isError && (
        <Text variant="caption" color="danger">
          {t(translateErrorKey(translate.error))}
        </Text>
      )}

      {data && (
        <View style={styles.wrap}>
          <View style={[styles.summary, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name={data.kind === 'menu' ? 'restaurant-outline' : 'information-circle-outline'} size={20} color={colors.primary} />
            <View style={styles.flex}>
              {data.source_language && (
                <Text variant="caption" color="textMuted">
                  {t('translate.detected', { language: translateLanguage(data.source_language).name })}
                </Text>
              )}
              <Text variant="body">{data.summary}</Text>
            </View>
          </View>
          {sections.map((section) => (
            <View key={section} style={styles.section}>
              {section !== '' && <Text variant="subtitle">{section}</Text>}
              {data.items
                .filter((i) => (i.section ?? '') === section)
                .map((i, n) => (
                  <View key={`${section}-${n}`} style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <View style={styles.itemTop}>
                      <Text variant="bodyStrong" style={styles.flex}>
                        {i.translated}
                      </Text>
                      {i.price && <Text variant="bodyStrong">{i.price}</Text>}
                    </View>
                    <Text variant="caption" color="textMuted">
                      {i.original}
                    </Text>
                    {i.note && (
                      <Text variant="caption" color="textSecondary">
                        {i.note}
                      </Text>
                    )}
                  </View>
                ))}
            </View>
          ))}
          {data.kind === 'menu' && (
            <Text variant="caption" color="textMuted">
              {t('translate.allergyDisclaimer')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  preview: { width: '100%', height: 180, borderRadius: Radius.lg },
  summary: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  section: { gap: Spacing.sm },
  item: { gap: Spacing.xxs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  itemTop: { flexDirection: 'row', gap: Spacing.sm },
});
