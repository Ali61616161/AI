import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import * as Speech from 'expo-speech';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { SUPPORTED_LANGUAGES } from '@/i18n/languages';
import { PHRASE_LANGUAGES, PHRASES, phraseLanguageForCountry, SPEECH_LOCALE, type Phrase, type PhraseLanguage } from '@/features/offline/phrases';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const isRtl = (lang: PhraseLanguage) => lang === 'ar';

/** İnternetsiz çalışan acil durum cümleleri: büyük yazıyla göster veya sesli oku. */
export default function PhrasesScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { country } = useLocalSearchParams<{ country?: string }>();
  const mine = (PHRASE_LANGUAGES as readonly string[]).includes(i18n.language) ? (i18n.language as PhraseLanguage) : 'en';
  const initial = phraseLanguageForCountry(country);
  const [target, setTarget] = useState<PhraseLanguage>(initial === mine && mine !== 'en' ? 'en' : initial);
  const [shown, setShown] = useState<Phrase | null>(null);

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: SPEECH_LOCALE[target], rate: 0.9 });
  };

  return (
    <Screen>
      <ModalHeader title={t('phrases.title')} subtitle={t('phrases.subtitle')} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {PHRASE_LANGUAGES.filter((l) => l !== mine).map((l) => (
          <Chip key={l} label={SUPPORTED_LANGUAGES.find((x) => x.code === l)?.nativeName ?? l} selected={l === target} onPress={() => setTarget(l)} />
        ))}
      </ScrollView>

      {PHRASES.map((p) => (
        <View key={p.key} style={[styles.row, { backgroundColor: colors.surface, borderColor: p.urgent ? colors.danger : colors.border }]}>
          <Pressable accessibilityRole="button" accessibilityHint={t('phrases.showHint')} onPress={() => setShown(p)} style={styles.texts}>
            <Text variant="caption" color="textSecondary">
              {p.text[mine]}
            </Text>
            <Text variant="bodyStrong" style={{ writingDirection: isRtl(target) ? 'rtl' : 'ltr' }}>
              {p.text[target]}
            </Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('phrases.speak')} onPress={() => speak(p.text[target])} style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
            <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
          </Pressable>
        </View>
      ))}

      <Modal visible={shown !== null} animationType="fade" onRequestClose={() => setShown(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setShown(null)} style={[styles.full, { backgroundColor: colors.background }]}>
          {shown && (
            <>
              <Text variant="display" style={[styles.big, { writingDirection: isRtl(target) ? 'rtl' : 'ltr' }]}>
                {shown.text[target]}
              </Text>
              <Text variant="body" color="textSecondary" style={styles.center}>
                {shown.text[mine]}
              </Text>
              <Text variant="caption" color="textMuted" style={styles.center}>
                {t('phrases.tapToClose')}
              </Text>
            </>
          )}
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  texts: { flex: 1, gap: Spacing.xxs },
  icon: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, justifyContent: 'center', gap: Spacing.xl, padding: Spacing.xl },
  big: { fontSize: 44, lineHeight: 54, textAlign: 'center' },
  center: { textAlign: 'center' },
});
