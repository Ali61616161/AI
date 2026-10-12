import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { changeLanguage, currentLanguage, restartApp } from '@/i18n';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { Spacing } from '@/theme/tokens';

export function LanguagePicker({ align = 'start' }: { align?: 'start' | 'center' }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<LanguageCode>(currentLanguage());

  async function select(code: LanguageCode) {
    setSelected(code);
    const { needsRestart } = await changeLanguage(code);
    if (needsRestart) {
      Alert.alert(t('language.restartTitle'), t('language.restartMessage'), [
        { text: t('language.later'), style: 'cancel' },
        { text: t('language.restartNow'), onPress: restartApp },
      ]);
    }
  }

  return (
    <View style={[styles.grid, align === 'center' && styles.centered]} accessibilityRole="radiogroup">
      {SUPPORTED_LANGUAGES.map((lang) => (
        <Chip key={lang.code} label={lang.nativeName} selected={lang.code === selected} onPress={() => select(lang.code)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  centered: { justifyContent: 'center' },
});
