import Ionicons from '@expo/vector-icons/Ionicons';
import * as Speech from 'expo-speech';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useTranslateVoice } from './api';
import { translateErrorKey } from './error-text';
import { LanguagePicker } from './language-picker';
import { RTL_LANGUAGES, translateLanguage } from './languages';
import { QuotaNote } from './quota-note';

type Side = 'me' | 'them';
type Turn = { id: number; side: Side; original: string; translated: string | null; error: string | null };

/** Olay işleyicilerinde kullanılan saat (render sırasında çağrılmaz). */
const now = () => Date.now();

const dir = (code: string) => (RTL_LANGUAGES.has(code.split('-')[0]) ? 'rtl' : 'ltr');

/**
 * Canlı, iki yönlü konuşma çevirisi. Konuşan kişi kendi düğmesine basar; konuşma
 * telefonun ses tanımasıyla yazıya dökülür, Google Translation ile çevrilir ve
 * karşı tarafın dilinde sesli okunur.
 */
export function Conversation({ myLanguage, theirLanguage, onLanguages }: { myLanguage: string; theirLanguage: string; onLanguages: (mine: string, theirs: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const translate = useTranslateVoice();
  const [listening, setListening] = useState<Side | null>(null);
  const [partial, setPartial] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const finalText = useRef('');
  const startedAt = useRef(0);
  const side = useRef<Side>('me');

  const langOf = (s: Side) => (s === 'me' ? myLanguage : theirLanguage);

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    setPartial(text);
    if (e.isFinal) finalText.current = text;
  });
  useSpeechRecognitionEvent('error', (e) => {
    setProblem(e.error === 'not-allowed' ? t('translate.micDenied') : e.error === 'no-speech' || e.error === 'speech-timeout' ? t('translate.noSpeech') : t('translate.speechFailed'));
  });
  useSpeechRecognitionEvent('end', () => {
    const who = side.current;
    const text = (finalText.current || '').trim();
    const seconds = Math.max(1, Math.round((now() - startedAt.current) / 1000));
    setListening(null);
    setPartial('');
    if (!text) return;
    const id = now();
    setTurns((prev) => [...prev, { id, side: who, original: text, translated: null, error: null }]);
    const source = langOf(who);
    const target = langOf(who === 'me' ? 'them' : 'me');
    translate.mutate(
      { text, source, target, seconds },
      {
        onSuccess: (r) => {
          setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, translated: r.text } : x)));
          Speech.stop();
          Speech.speak(r.text, { language: translateLanguage(target).speech });
        },
        onError: (err) => setTurns((prev) => prev.map((x) => (x.id === id ? { ...x, error: t(translateErrorKey(err)) } : x))),
      },
    );
  });

  async function start(who: Side) {
    setProblem(null);
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setProblem(t('translate.speechUnavailable'));
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setProblem(t('translate.micDenied'));
      return;
    }
    Speech.stop();
    side.current = who;
    finalText.current = '';
    startedAt.current = now();
    setListening(who);
    ExpoSpeechRecognitionModule.start({ lang: translateLanguage(langOf(who)).speech, interimResults: true, continuous: false, addsPunctuation: true });
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.langs}>
        <LanguagePicker label={t('translate.myLanguage')} value={myLanguage} onChange={(c) => onLanguages(c, theirLanguage)} />
        <Ionicons name="chatbubbles-outline" size={20} color={colors.textSecondary} />
        <LanguagePicker label={t('translate.theirLanguage')} value={theirLanguage} onChange={(c) => onLanguages(myLanguage, c)} />
      </View>
      <QuotaNote feature="voice_translation" />

      <View style={styles.turns}>
        {turns.length === 0 && !listening && (
          <Text variant="body" color="textMuted" style={styles.center}>
            {t('translate.conversationHint')}
          </Text>
        )}
        {turns.map((turn) => {
          const mine = turn.side === 'me';
          const target = langOf(mine ? 'them' : 'me');
          return (
            <View
              key={turn.id}
              style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border }]}>
              <Text variant="caption" style={{ color: mine ? colors.onPrimary : colors.textSecondary, writingDirection: dir(langOf(turn.side)) }}>
                {turn.original}
              </Text>
              {turn.translated ? (
                <Pressable accessibilityRole="button" accessibilityHint={t('phrases.speak')} onPress={() => Speech.speak(turn.translated!, { language: translateLanguage(target).speech })}>
                  <Text variant="bodyStrong" style={{ color: mine ? colors.onPrimary : colors.text, writingDirection: dir(target) }}>
                    {turn.translated}
                  </Text>
                </Pressable>
              ) : turn.error ? (
                <Text variant="caption" style={{ color: mine ? colors.onPrimary : colors.danger }}>
                  {turn.error}
                </Text>
              ) : (
                <Text variant="caption" style={{ color: mine ? colors.onPrimary : colors.textMuted }}>
                  {t('translate.translating')}
                </Text>
              )}
            </View>
          );
        })}
        {listening && (
          <View style={[styles.bubble, listening === 'me' ? styles.mine : styles.theirs, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text variant="body" color="textSecondary">
              {partial || t('translate.listening')}
            </Text>
          </View>
        )}
      </View>

      {problem && (
        <Text variant="caption" color="warning">
          {problem}
        </Text>
      )}

      <View style={styles.mics}>
        {(['me', 'them'] as Side[]).map((s) => {
          const active = listening === s;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t(s === 'me' ? 'translate.speakMine' : 'translate.speakTheirs', { language: translateLanguage(langOf(s)).name })}
              disabled={listening !== null && !active}
              onPress={() => start(s)}
              style={[styles.mic, { backgroundColor: active ? colors.danger : s === 'me' ? colors.primary : colors.accent, opacity: listening && !active ? 0.4 : 1 }]}>
              <Ionicons name={active ? 'stop' : 'mic'} size={28} color={colors.onPrimary} />
              <Text variant="bodyStrong" style={{ color: colors.onPrimary }} numberOfLines={1}>
                {translateLanguage(langOf(s)).name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  langs: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  turns: { gap: Spacing.sm, minHeight: 160 },
  center: { textAlign: 'center', paddingVertical: Spacing.xl },
  bubble: { maxWidth: '88%', gap: Spacing.xxs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  mics: { flexDirection: 'row', gap: Spacing.md },
  mic: { flex: 1, alignItems: 'center', gap: Spacing.xs, paddingVertical: Spacing.lg, borderRadius: Radius.xl },
});
