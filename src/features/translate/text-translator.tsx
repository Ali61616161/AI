import Ionicons from '@expo/vector-icons/Ionicons';
import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useTranslateText } from './api';
import { translateErrorKey } from './error-text';
import { LanguagePicker } from './language-picker';
import { RTL_LANGUAGES, translateLanguage } from './languages';
import { QuotaNote } from './quota-note';
import { speakNatural } from './speak';

export function TextTranslator({ myLanguage, theirLanguage, onLanguages }: { myLanguage: string; theirLanguage: string; onLanguages: (mine: string, theirs: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [source, setSource] = useState<string>('auto');
  const [input, setInput] = useState('');
  const [copied, setCopied] = useState(false);
  const translate = useTranslateText();
  const target = theirLanguage;
  const result = translate.data;

  function run() {
    if (!input.trim()) return;
    setCopied(false);
    translate.mutate({ text: input, target, source: source === 'auto' ? null : source });
  }

  function swap() {
    const from = source === 'auto' ? (result?.detected_source ?? myLanguage) : source;
    onLanguages(target, from);
    setSource(target);
    if (result) setInput(result.text);
    translate.reset();
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.langs}>
        <LanguagePicker label={t('translate.from')} value={source} allowAuto onChange={setSource} />
        <Pressable accessibilityRole="button" accessibilityLabel={t('translate.swap')} onPress={swap} hitSlop={8} style={[styles.swap, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
        </Pressable>
        <LanguagePicker label={t('translate.to')} value={target} onChange={(code) => onLanguages(myLanguage, code)} />
      </View>

      <TextInput
        value={input}
        onChangeText={setInput}
        multiline
        maxLength={2000}
        placeholder={t('translate.textPlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('translate.textPlaceholder')}
        style={[Typography.body, styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, textAlign: 'auto' }]}
      />
      <Button title={t('translate.translate')} loading={translate.isPending} disabled={!input.trim()} onPress={run} />
      <QuotaNote feature="text_translation" />

      {translate.isError && (
        <Text variant="caption" color={translate.error && translateErrorKey(translate.error).endsWith('quota_exceeded') ? 'warning' : 'danger'}>
          {t(translateErrorKey(translate.error))}
        </Text>
      )}

      {result && (
        <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          {source === 'auto' && result.detected_source && (
            <Text variant="caption" color="textMuted">
              {t('translate.detected', { language: translateLanguage(result.detected_source).name })}
            </Text>
          )}
          <Text variant="title" selectable style={{ writingDirection: RTL_LANGUAGES.has(target.split('-')[0]) ? 'rtl' : 'ltr' }}>
            {result.text}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('phrases.speak')}
              onPress={() => {
                speakNatural(result.text, translateLanguage(target).speech);
              }}
              style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="volume-high-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('translate.copy')}
              onPress={async () => {
                await Clipboard.setStringAsync(result.text);
                setCopied(true);
              }}
              style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={20} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  langs: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  swap: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 120, maxHeight: 240, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, textAlignVertical: 'top' },
  result: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1.5 },
  actions: { flexDirection: 'row', gap: Spacing.sm },
  icon: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
