import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { changeLanguage, currentLanguage, restartApp } from '@/i18n';
import { SUPPORTED_LANGUAGES, type LanguageCode } from '@/i18n/languages';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export function LanguagePicker() {
  const { t } = useTranslation();
  const { colors } = useTheme();
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
    <View style={styles.grid}>
      {SUPPORTED_LANGUAGES.map((lang) => {
        const active = lang.code === selected;
        return (
          <Pressable
            key={lang.code}
            accessibilityRole="radio"
            accessibilityState={{ selected: active }}
            onPress={() => select(lang.code)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}>
            <Text variant="caption" style={{ color: active ? colors.onPrimary : colors.text }}>
              {lang.nativeName}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  chip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
});
