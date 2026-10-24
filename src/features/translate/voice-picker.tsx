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
import { CLOUD_VOICES, isCloudVoice, pickVoice, previewText, qualityScore, rankVoices, type VoiceLike } from './voices';

const MAX_DEVICE_VOICES = 4;

/**
 * Ses seçimi, sade: her dil için "kadın / erkek" (Yola'nın doğal sesi). Telefon sesleri (internetsiz
 * okuma için) varsayılan olarak kapalı bir bölümde durur; ayar gerektirmez.
 */
export function VoicePicker({ languages }: { languages: { name: string; speech: string }[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const chosen = useTranslateStore((s) => s.voices);
  const setVoice = useTranslateStore((s) => s.setVoice);
  const [voices, setVoices] = useState<VoiceLike[] | null>(null);
  const [deviceOpen, setDeviceOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    loadVoices().then((v) => alive && setVoices(v));
    return () => {
      alive = false;
    };
  }, []);

  const radio = (speech: string, id: string, label: string, active: string | null | undefined, badge?: string) => (
    <Tap
      key={id}
      accessibilityRole="radio"
      accessibilityState={{ selected: id === active }}
      onPress={() => {
        setVoice(speech, id);
        speakNatural(previewText(speech), speech);
      }}
      feedback="select">
      <View style={styles.row}>
        <Ionicons name={id === active ? 'radio-button-on' : 'radio-button-off'} size={20} color={id === active ? colors.primary : colors.textMuted} />
        <Text variant="body" style={styles.flex} numberOfLines={1}>
          {label}
        </Text>
        {badge && (
          <Text variant="caption" color="primary">
            {badge}
          </Text>
        )}
        <Ionicons name="volume-medium-outline" size={18} color={colors.textMuted} />
      </View>
    </Tap>
  );

  return (
    <Card variant="solid" padding={Spacing.md}>
      <View style={styles.gap}>
        {languages.map((lang) => {
          const choice = chosen[lang.speech];
          const cloudActive = !choice || isCloudVoice(choice) ? (choice ?? 'yola:female') : null;
          const ranked = voices ? rankVoices(voices, lang.speech).slice(0, MAX_DEVICE_VOICES) : [];
          const deviceActive = voices && !cloudActive ? pickVoice(voices, lang.speech, choice)?.identifier : null;
          return (
            <View key={lang.speech} style={styles.gap}>
              <Text variant="overline" color="textMuted">
                {lang.name}
              </Text>
              {CLOUD_VOICES.map((id) => radio(lang.speech, id, t(id === 'yola:female' ? 'translate.voice.female' : 'translate.voice.male'), cloudActive))}
              {ranked.length > 0 && (
                <>
                  <Tap accessibilityRole="button" accessibilityState={{ expanded: deviceOpen || !cloudActive }} onPress={() => setDeviceOpen((v) => !v)} feedback="select">
                    <View style={styles.row}>
                      <Text variant="caption" color="textSecondary" style={styles.flex}>
                        {t('translate.voice.deviceTitle')}
                      </Text>
                      <Ionicons name={deviceOpen || !cloudActive ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
                    </View>
                  </Tap>
                  {(deviceOpen || !cloudActive) &&
                    ranked.map((v) => radio(lang.speech, v.identifier, v.name, deviceActive, qualityScore(v) >= 4 ? t('translate.voice.enhanced') : undefined))}
                </>
              )}
            </View>
          );
        })}
        <Text variant="caption" color="textMuted">
          {t('translate.voice.cloudNote')}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  gap: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  flex: { flex: 1 },
});
