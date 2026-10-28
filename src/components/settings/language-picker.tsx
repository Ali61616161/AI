import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { changeLanguage, currentLanguage } from '@/i18n';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { queryClient } from '@/lib/query-client';
import { useReloadStore } from '@/stores/reload-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Profil → Dil: mevcut dil bir satırda görünür, dokununca kaydırılabilir liste açılır. Başka dil seçilince onay
 * istenir; onaylanırsa dil kaydedilir ve uygulama yeniden yüklenir (açık ekranlar ve sohbetler sıfırlanır).
 * Uygulama ilk açılışta cihaz dilini kullanır, desteklenmiyorsa İngilizce'ye düşer (bkz. i18n/index.ts).
 */
export function LanguagePicker() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reload = useReloadStore((s) => s.reload);
  const [open, setOpen] = useState(false);
  const current = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage());

  function confirm(code: LanguageCode) {
    setOpen(false);
    if (code === currentLanguage()) return;
    Alert.alert(t('language.confirmTitle'), t('language.confirmMessage'), [
      { text: t('language.cancel'), style: 'cancel' },
      {
        text: t('language.confirm'),
        onPress: async () => {
          const { needsRestart } = await changeLanguage(code);
          // Önceki dildeki önbellek (yer açıklamaları, hava metni vb.) silinir; internet yokken çevrimdışı görünüm bozulmasın.
          if (onlineManager.isOnline()) queryClient.clear();
          reload();
          // Yazı yönü değiştiyse (Arapça ↔ diğerleri) iOS tam kapatıp açmadan uygulamaz.
          if (needsRestart) Alert.alert(t('language.restartTitle'), t('language.restartMessage'));
        },
      },
    ]);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('language.title')}: ${current?.nativeName ?? ''}`}
        onPress={() => setOpen(true)}
        style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="language-outline" size={20} color={colors.primary} />
        <Text variant="bodyStrong" style={styles.flex}>
          {current?.nativeName}
        </Text>
        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text variant="title">{t('language.subtitle')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            {SUPPORTED_LANGUAGES.map((lang) => {
              const selected = lang.code === current?.code;
              return (
                <Pressable key={lang.code} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => confirm(lang.code)} style={[styles.item, { borderColor: colors.border }]}>
                  <Text variant="body" style={styles.flex}>
                    {lang.nativeName}
                  </Text>
                  {selected && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  sheet: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
