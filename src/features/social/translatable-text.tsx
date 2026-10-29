import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { currentLanguage } from '@/i18n';
import { Spacing } from '@/theme/tokens';

import { translateMessage, type MessageTranslation, type TranslateErrorCode } from './api';

type State = { status: 'idle' } | { status: 'loading' } | { status: 'done'; result: MessageTranslation; shown: boolean } | { status: 'error'; code: TranslateErrorCode };

/**
 * Karşı tarafın mesajı: dokununca uygulamanın diline çevrilir, tekrar dokununca özgünü gösterir. Çeviri oturum
 * boyunca bellekte tutulur (sunucu saklamaz), bu yüzden aynı mesaj için ikinci dokunuş istek atmaz.
 */
export function TranslatableText({ target, text, color, mutedColor, onLongPress }: { target: { messageId: number } | { inviteId: string }; text: string; color: string; mutedColor: string; onLongPress?: () => void }) {
  const { t } = useTranslation();
  const [state, setState] = useState<State>({ status: 'idle' });

  async function press() {
    if (state.status === 'loading') return;
    if (state.status === 'done') {
      setState({ ...state, shown: !state.shown });
      return;
    }
    setState({ status: 'loading' });
    try {
      setState({ status: 'done', result: await translateMessage(target, currentLanguage()), shown: true });
    } catch (e) {
      setState({ status: 'error', code: (e as { code?: TranslateErrorCode }).code ?? 'failed' });
    }
  }

  const translated = state.status === 'done' && state.shown && !state.result.same;
  const hint =
    state.status === 'loading'
      ? t('social.translating')
      : state.status === 'error'
        ? t(state.code === 'quota_exceeded' ? 'social.translateLimit' : 'social.translateFailed')
        : state.status === 'done'
          ? state.result.same
            ? t('social.alreadyYourLanguage')
            : state.shown
              ? t('social.showOriginal')
              : t('social.translate')
          : t('social.translate');

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${text}. ${hint}`} onPress={press} onLongPress={onLongPress} style={styles.wrap}>
      <Text variant="body" style={{ color }}>
        {translated ? state.result.text : text}
      </Text>
      <View style={styles.hint}>
        <Ionicons name="language-outline" size={13} color={mutedColor} />
        <Text variant="caption" style={{ color: mutedColor }}>
          {hint}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  hint: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
