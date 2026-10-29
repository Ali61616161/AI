import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { openInMaps } from '@/features/places/api';
import { REPORT_REASONS, useBlockAndReport, useMessages, useMyInvites, useSendMessage } from '@/features/social/api';
import { TranslatableText } from '@/features/social/translatable-text';
import { formatLocalDateTime, formatTime } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Kabul edilmiş davetin sohbeti: buluşma bilgisi, mesajlar, engelle ve şikayet et. */
export default function ChatScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSessionStore((s) => s.session?.user.id);
  const { data: invites } = useMyInvites();
  const invite = invites?.find((i) => i.id === id);
  const { data: messages } = useMessages(id);
  const send = useSendMessage(id);
  const safety = useBlockAndReport();
  const [text, setText] = useState('');
  const [reporting, setReporting] = useState(false);
  const canWrite = invite?.status === 'accepted';
  const when = invite ? formatLocalDateTime(invite.meet_at, null) : '';

  async function submit() {
    if (!text.trim()) return;
    await send.mutateAsync(text);
    setText('');
  }

  async function block(reason?: (typeof REPORT_REASONS)[number]) {
    if (!invite) return;
    await safety.mutateAsync({ userId: invite.other_id, inviteId: invite.id, reason });
    router.back();
  }

  function confirmBlock() {
    if (!invite) return;
    Alert.alert(t('social.blockConfirmTitle', { name: invite.other_name ?? t('social.traveler') }), t('social.blockConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('social.block'), style: 'destructive', onPress: () => block() },
    ]);
  }

  function shareMeeting() {
    if (!invite) return;
    const maps = invite.place_lat !== null ? `https://www.google.com/maps/search/?api=1&query=${invite.place_lat},${invite.place_lng}` : '';
    Share.share({ message: t('social.shareMeetingText', { name: invite.other_name ?? '', place: invite.place_name, time: when, maps }) });
  }

  return (
    <Screen
      footer={
        <View style={[styles.composer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            editable={canWrite}
            maxLength={2000}
            multiline
            placeholder={canWrite ? t('social.writeMessage') : t('social.chatClosed')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('social.writeMessage')}
            style={[Typography.body, styles.input, { color: colors.text }]}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            disabled={!canWrite || !text.trim() || send.isPending}
            onPress={submit}
            style={[styles.send, { backgroundColor: canWrite && text.trim() ? colors.primary : colors.surfaceMuted }]}>
            <Ionicons name="arrow-up" size={20} color={canWrite && text.trim() ? colors.onPrimary : colors.textMuted} />
          </Pressable>
        </View>
      }>
      <ModalHeader title={invite?.other_name ?? t('social.traveler')} subtitle={invite ? `${invite.place_name} · ${when}` : undefined} />

      {invite && (
        <View style={styles.actions}>
          <Chip icon="navigate-outline" label={t('map.openInMaps')} onPress={() => openInMaps({ name: invite.place_name, placeId: invite.google_place_id, lat: invite.place_lat, lng: invite.place_lng })} />
          <Chip icon="share-outline" label={t('social.shareMeeting')} onPress={shareMeeting} />
          <Chip icon="ban-outline" label={t('social.block')} onPress={confirmBlock} />
          <Chip icon="flag-outline" label={t('social.report')} onPress={() => setReporting((v) => !v)} />
        </View>
      )}

      {reporting && (
        <View style={[styles.report, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="bodyStrong">{t('social.reportTitle')}</Text>
          <View style={styles.actions}>
            {REPORT_REASONS.map((r) => (
              <Chip key={r} label={t(`social.reasons.${r}`)} onPress={() => block(r)} />
            ))}
          </View>
          <Button title={t('social.blockOnly')} variant="ghost" loading={safety.isPending} onPress={() => block()} />
          <Text variant="caption" color="textMuted">
            {t('social.reportNote')}
          </Text>
        </View>
      )}

      <View style={[styles.tip, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.accent} />
        <Text variant="caption" style={styles.flex}>
          {t('social.chatSafety')}
        </Text>
      </View>

      <View style={styles.messages}>
        {invite?.message && (
          <View style={[styles.bubble, invite.incoming ? styles.theirs : styles.mine, { backgroundColor: invite.incoming ? colors.surface : colors.primary, borderColor: colors.border }]}>
            {invite.incoming ? (
              <TranslatableText target={{ inviteId: invite.id }} text={invite.message} color={colors.text} mutedColor={colors.textMuted} />
            ) : (
              <Text variant="body" style={{ color: colors.onPrimary }}>
                {invite.message}
              </Text>
            )}
          </View>
        )}
        {messages?.map((m) => {
          const mine = m.sender_id === me;
          return (
            <View key={m.id} style={[styles.bubble, mine ? styles.mine : styles.theirs, { backgroundColor: mine ? colors.primary : colors.surface, borderColor: colors.border }]}>
              {mine ? (
                <Text variant="body" style={{ color: colors.onPrimary }}>
                  {m.body}
                </Text>
              ) : (
                <TranslatableText target={{ messageId: m.id }} text={m.body} color={colors.text} mutedColor={colors.textMuted} />
              )}
              <Text variant="caption" style={{ color: mine ? colors.onPrimary : colors.textMuted, opacity: 0.8 }}>
                {formatTime(m.created_at, null)}
              </Text>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  report: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  tip: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  flex: { flex: 1 },
  messages: { gap: Spacing.sm },
  bubble: { maxWidth: '85%', gap: 2, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  mine: { alignSelf: 'flex-end' },
  theirs: { alignSelf: 'flex-start' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.sm, paddingLeft: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  input: { flex: 1, maxHeight: 120, paddingVertical: Spacing.sm },
  send: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
