import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { useIsOnline } from '@/features/offline/use-online';
import { usePhraseCache } from '@/features/offline/phrase-cache';
import { buildBatch, isRtlLanguage, parseBatch } from '@/features/offline/phrase-translation';
import { PHRASE_LANGUAGES, PHRASES, type Phrase, type PhraseLanguage } from '@/features/offline/phrases';
import { useTranslateText } from '@/features/translate/api';
import { languageForCountry, TRANSLATE_LANGUAGES, translateLanguage } from '@/features/translate/languages';
import { speakNatural } from '@/features/translate/speak';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Çeviri kodu → yerleşik (internetsiz) cümle dili; yoksa null ve çeviri servisi kullanılır. */
function builtIn(code: string): PhraseLanguage | null {
  if (code === 'zh-CN') return 'zh';
  return (PHRASE_LANGUAGES as readonly string[]).includes(code) ? (code as PhraseLanguage) : null;
}

/**
 * Acil durum cümleleri: seyahatteyken o ülkenin diliyle açılır, istenen dil listeden seçilir.
 * 8 dil uygulamanın içindedir (internetsiz); diğer diller bir kez çevrilip telefona kaydedilir.
 */
export default function PhrasesScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { country } = useLocalSearchParams<{ country?: string }>();
  const online = useIsOnline();
  const mineCode = builtIn(i18n.language) ? i18n.language : 'en';
  const mine = (builtIn(mineCode) ?? 'en') as PhraseLanguage;
  const initial = languageForCountry(country) ?? 'en';
  const [target, setTarget] = useState(initial === mineCode ? 'en' : initial);
  const [shown, setShown] = useState<Phrase | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const failed = failedFor === target;

  const builtin = builtIn(target);
  const cached = usePhraseCache((s) => s.translations[target]);
  const save = usePhraseCache((s) => s.save);
  const translate = useTranslateText();
  // Yeni sürümde cümle eklendiyse eski kayıtta eksik kalanlar için dil yeniden indirilir.
  const needsDownload = !builtin && (!cached || PHRASES.some((p) => !cached[p.key]));

  useEffect(() => {
    if (!needsDownload || !online) return;
    let alive = true;
    translate
      .mutateAsync({ text: buildBatch(PHRASES.map((p) => p.text.en)), target, source: 'en' })
      .then((r) => {
        const texts = parseBatch(r.text, PHRASES.length);
        // Dil bu arada değişse bile sonuç kaydedilir (çeviri hakkı boşa gitmesin, geri dönünce hazır olsun).
        if (texts) save(target, Object.fromEntries(PHRASES.map((p, i) => [p.key, texts[i]])));
        else if (alive) setFailedFor(target);
      })
      .catch(() => alive && setFailedFor(target));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, needsDownload, online]);

  const options = useMemo(() => TRANSLATE_LANGUAGES.filter((l) => l.code !== mineCode).map((l) => ({ value: l.code, label: l.name })), [mineCode]);
  const lang = translateLanguage(target);
  const rtl = isRtlLanguage(target);
  const textFor = (p: Phrase): string | null => (builtin ? p.text[builtin] : (cached?.[p.key] ?? null));
  const speak = (text: string) => speakNatural(text, lang.speech, { rate: 0.9 });
  const ready = !needsDownload;

  return (
    <Screen>
      <ModalHeader title={t('phrases.title')} subtitle={t('phrases.subtitle')} />
      <SelectSheet label={t('phrases.language')} value={target} options={options} placeholder={lang.name} onChange={setTarget} />

      {!ready && (
        <View style={styles.status}>
          {translate.isPending && <ActivityIndicator color={colors.primary} />}
          <Text variant="caption" color={failed || !online ? 'warning' : 'textSecondary'}>
            {!online ? t('phrases.needOnline') : failed || translate.isError ? t('phrases.downloadFailed') : t('phrases.downloading')}
          </Text>
        </View>
      )}

      {PHRASES.map((p) => {
        const text = textFor(p);
        return (
          <View key={p.key} style={[styles.row, { backgroundColor: colors.surface, borderColor: p.urgent ? colors.danger : colors.border }]}>
            <Pressable accessibilityRole="button" accessibilityHint={t('phrases.showHint')} disabled={!text} onPress={() => setShown(p)} style={styles.texts}>
              <Text variant="caption" color="textSecondary">
                {p.text[mine]}
              </Text>
              <Text variant="bodyStrong" style={{ writingDirection: rtl ? 'rtl' : 'ltr' }}>
                {text ?? p.text.en}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('phrases.speak')} disabled={!text} onPress={() => text && speak(text)} style={[styles.icon, { backgroundColor: colors.surfaceMuted, opacity: text ? 1 : 0.4 }]}>
              <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
            </Pressable>
          </View>
        );
      })}

      <Modal visible={shown !== null} animationType="fade" onRequestClose={() => setShown(null)}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setShown(null)} style={[styles.full, { backgroundColor: colors.background }]}>
          {shown && (
            <>
              <Text variant="display" style={[styles.big, { writingDirection: rtl ? 'rtl' : 'ltr' }]}>
                {textFor(shown)}
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
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  texts: { flex: 1, gap: Spacing.xxs },
  icon: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  full: { flex: 1, justifyContent: 'center', gap: Spacing.xl, padding: Spacing.xl },
  big: { fontSize: 44, lineHeight: 54, textAlign: 'center' },
  center: { textAlign: 'center' },
});
