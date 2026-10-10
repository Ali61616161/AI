import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Message = { id: number; from: 'user' | 'assistant'; text: string };

const SUGGESTIONS = ['suggestionRain', 'suggestionDelay', 'suggestionTired', 'suggestionBudget'] as const;

const QUICK_ACTIONS: {
  key: 'addTicket' | 'menuScan' | 'sos';
  icon: ComponentProps<typeof Ionicons>['name'];
  step?: number;
}[] = [
  { key: 'addTicket', icon: 'ticket-outline' },
  { key: 'menuScan', icon: 'camera-outline', step: 9 },
  { key: 'sos', icon: 'medkit-outline', step: 10 },
];

/**
 * "Planı Değiştir" asistanı. AI bağlantısı 6. adımda eklenecek; şimdilik
 * arayüz ve akış hazır, gönderilen istek alındı olarak yanıtlanır.
 */
export default function AssistantScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);

  function send(text: string) {
    const message = text.trim();
    if (!message) return;
    setMessages((prev) => [
      ...prev,
      { id: prev.length, from: 'user', text: message },
      { id: prev.length + 1, from: 'assistant', text: t('assistant.notReady', { message }) },
    ]);
    setInput('');
  }

  return (
    <Screen
      footer={
        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('assistant.placeholder')}
            style={[Typography.body, styles.input, { color: colors.text, textAlign: 'auto' }]}
            multiline
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            onPress={() => send(input)}
            disabled={!input.trim()}
            style={[styles.send, { backgroundColor: input.trim() ? colors.primary : colors.surfaceMuted }]}>
            <Ionicons name="arrow-up" size={20} color={input.trim() ? colors.onPrimary : colors.textMuted} />
          </Pressable>
        </View>
      }>
      <ModalHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} />

      <View style={styles.quick}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            disabled={Boolean(a.step)}
            onPress={() => a.key === 'addTicket' && router.replace('/ticket')}
            style={[styles.quickItem, { backgroundColor: colors.surface, borderColor: colors.border, opacity: a.step ? 0.55 : 1 }]}>
            <Ionicons name={a.icon} size={22} color={a.key === 'sos' ? colors.danger : colors.primary} />
            <Text variant="caption" style={styles.center}>
              {t(`assistant.${a.key}`)}
            </Text>
            {a.step && (
              <Text variant="caption" color="textMuted" style={[styles.center, styles.small]}>
                {t('common.comingSoon')}
              </Text>
            )}
          </Pressable>
        ))}
      </View>

      {messages.length === 0 ? (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={t(`assistant.${s}`)} onPress={() => send(t(`assistant.${s}`))} />
          ))}
        </View>
      ) : (
        <View style={styles.messages}>
          {messages.map((m) => (
            <View
              key={m.id}
              style={[
                styles.bubble,
                m.from === 'user'
                  ? { alignSelf: 'flex-end', backgroundColor: colors.primary }
                  : { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
              ]}>
              <Text variant="body" style={m.from === 'user' ? { color: colors.onPrimary } : undefined}>
                {m.text}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  quick: { flexDirection: 'row', gap: Spacing.sm },
  quickItem: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
  },
  small: { fontSize: 11, lineHeight: 14 },
  center: { textAlign: 'center' },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  messages: { gap: Spacing.md },
  bubble: { maxWidth: '85%', padding: Spacing.md, borderRadius: Radius.lg },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
    padding: Spacing.sm,
    paddingLeft: Spacing.lg,
    borderRadius: Radius.xl,
    borderWidth: 1,
  },
  input: { flex: 1, maxHeight: 120, paddingVertical: Spacing.sm },
  send: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
