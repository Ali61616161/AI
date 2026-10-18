import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { loadVoices, speakNatural } from './speak';
import { useTranslateStore } from './translate-store';
import { pickVoice, previewText, qualityScore, rankVoices, type VoiceLike } from './voices';

const MAX_VOICES = 6;

/** Seçilen diller için ses listesi: dinleyip beğenileni seç; "Gelişmiş" sesler daha doğal okur. */
export function VoicePicker({ languages }: { languages: { name: string; speech: string }[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const chosen = useTranslateStore((s) => s.voices);
  const setVoice = useTranslateStore((s) => s.setVoice);
  const [voices, setVoices] = useState<VoiceLike[] | null>(null);

  useEffect(() => {
    let alive = true;
    loadVoices().then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Card variant="solid" padding={Spacing.md}>
      <View style={styles.gap}>
        {languages.map((lang) => {
          const ranked = voices ? rankVoices(voices, lang.speech).slice(0, MAX_VOICES) : [];
          const active = voices ? pickVoice(voices, lang.speech, chosen[lang.speech])?.identifier : null;
          const hasBetter = ranked.some((v) => qualityScore(v) >= 4);
          return (
            <View key={lang.speech} style={styles.gap}>
              <Text variant="overline" color="textMuted">
                {lang.name}
              </Text>
              {ranked.length === 0 ? (
                <Text variant="caption" color="textSecondary">
                  {voices ? t('translate.voice.none') : '…'}
                </Text>
              ) : (
                ranked.map((v) => (
                  <Tap
                    key={v.identifier}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: v.identifier === active }}
                    onPress={() => {
                      setVoice(lang.speech, v.identifier);
                      speakNatural(previewText(lang.speech), lang.speech);
                    }}
                    feedback="select">
                    <View style={styles.row}>
                      <Ionicons name={v.identifier === active ? 'radio-button-on' : 'radio-button-off'} size={20} color={v.identifier === active ? colors.primary : colors.textMuted} />
                      <Text variant="body" style={styles.flex} numberOfLines={1}>
                        {v.name}
                      </Text>
                      {qualityScore(v) >= 4 && (
                        <Text variant="caption" color="primary">
                          {t('translate.voice.enhanced')}
                        </Text>
                      )}
                      <Ionicons name="volume-medium-outline" size={18} color={colors.textMuted} />
                    </View>
                  </Tap>
                ))
              )}
              {voices && !hasBetter && (
                <Text variant="caption" color="textMuted">
                  {t('translate.voice.hint')}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  flex: { flex: 1 },
});
