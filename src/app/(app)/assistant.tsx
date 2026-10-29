import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { GradientBg } from '@/components/ui/gradient-bg';
import { Text } from '@/components/ui/text';
import { openBookingLink, openInMaps } from '@/features/places/api';
import { useIsOnline } from '@/features/offline/use-online';
import { PlaceMeta } from '@/features/places/place-row';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { ReplanError, useRestoreVersion, useTripAssistant, type AssistantResult, type CrisisResult } from '@/features/plan/replan';
import { currentTripFor, useTrips } from '@/features/trips/queries';
import { isCurrentOrFuture } from '@/features/trips/trip-name';
import { SelectSheet } from '@/components/ui/select-sheet';
import { formatMoney, todayIsoDate } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Message =
  | { id: number; from: 'user'; text: string }
  | { id: number; from: 'assistant'; text: string; result?: AssistantResult; tripId?: string | null; undone?: boolean; upgrade?: boolean };

const SUGGESTIONS = ['suggestionAsk', 'suggestionChange', 'suggestionRain', 'suggestionTired', 'suggestionBudget'] as const;

const QUICK_ACTIONS: {
  key: 'addTicket' | 'translate' | 'sos';
  icon: ComponentProps<typeof Ionicons>['name'];
  step?: number;
}[] = [
  { key: 'addTicket', icon: 'ticket-outline' },
  { key: 'translate', icon: 'language-outline' },
  { key: 'sos', icon: 'medkit-outline' },
];

function SuggestionCard({ item }: { item: CrisisResult['suggestions'][number] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.suggestion, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="bodyStrong" style={styles.time}>
        {item.start_time}
      </Text>
      <View style={styles.flex}>
        <Text variant="bodyStrong">{item.title}</Text>
        {item.place_name && (
          <Text variant="caption" color="textSecondary">
            {item.place_name}
          </Text>
        )}
        {item.description && (
          <Text variant="caption" color="textSecondary">
            {item.description}
          </Text>
        )}
        <View style={styles.badges}>
          {item.is_indoor !== null && (
            <Text variant="caption" color="textMuted">
              {item.is_indoor ? t('plan.indoor') : t('plan.outdoor')}
            </Text>
          )}
          {item.estimated_cost !== null && item.currency && (
            <Text variant="caption" color={item.estimated_cost === 0 ? 'accent' : 'textMuted'}>
              {item.estimated_cost === 0 ? t('plan.free') : t('plan.estimatedPrice', { amount: formatMoney(item.estimated_cost, item.currency) })}
            </Text>
          )}
        </View>
        {item.rating != null && <PlaceMeta rating={item.rating} ratingCount={item.rating_count ?? null} priceLevel={null} distanceM={null} />}
        {(item.place_name || item.booking_url) && (
          <View style={styles.badges}>
            {item.place_name && (
              <Chip
                icon="navigate-outline"
                label={t('map.openInMaps')}
                onPress={() => openInMaps({ name: item.place_name!, mapsUrl: item.maps_url, placeId: item.google_place_id, lat: item.lat, lng: item.lng })}
              />
            )}
            {item.booking_url && <Chip icon="ticket-outline" label={t('place.buyTicket')} onPress={() => openBookingLink(item.booking_url!)} />}
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * "Planı Değiştir" asistanı: kullanıcının durumunu, konumunu ve günün planını AI'a
 * verir; plan değişirse yeni sürüm kaydedilir ve tek dokunuşla geri alınabilir.
 */
export default function AssistantScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const session = useSessionStore((s) => s.session);
  const { data: trips } = useTrips();
  const today = todayIsoDate();
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);
  // Yalnızca kendi seyahatin düzenlenir (paylaşılan seyahati görüntüleyen planı değiştiremez); bitmiş seyahatler listelenmez.
  const ownTrips = useMemo(() => (trips ?? []).filter((x) => x.owner_id === userId && isCurrentOrFuture(x, today)), [trips, userId, today]);
  const current = currentTripFor(trips, today, userId);
  const { prefill, tripId: tripParam } = useLocalSearchParams<{ prefill?: string; tripId?: string }>();
  // Canlı görünüm ya da seyahat ekranından açılınca o seyahat seçili gelir.
  const paramTripId = ownTrips.find((x) => x.id === tripParam)?.id ?? null;
  const defaultTripId = paramTripId ?? (current && current.owner_id === userId ? current.id : null) ?? ownTrips[0]?.id ?? null;
  const [pickedTripId, setPickedTripId] = useState<string | null>(null);
  const currentTrip = ownTrips.find((x) => x.id === (pickedTripId ?? defaultTripId)) ?? null;
  const replan = useTripAssistant();
  const restore = useRestoreVersion(currentTrip?.id ?? '');
  const [input, setInput] = useState(prefill ?? '');
  const [messages, setMessages] = useState<Message[]>([]);
  const online = useIsOnline();
  const canAsk = Boolean(session) && isSupabaseConfigured() && online;

  async function send(text: string) {
    const message = text.trim();
    if (!message || replan.isPending || !currentTrip) return;
    setInput('');
    setMessages((prev) => [...prev, { id: prev.length, from: 'user', text: message }]);
    try {
      if (!currentTrip) return;
      const result = await replan.mutateAsync({ message, tripId: currentTrip.id });
      setMessages((prev) => [...prev, { id: prev.length, from: 'assistant', text: result.reply, result, tripId: currentTrip?.id ?? null }]);
    } catch (e) {
      const code = e instanceof ReplanError ? e.code : 'network';
      setMessages((prev) => [...prev, { id: prev.length, from: 'assistant', text: t(`plan.errors.${code}`), upgrade: code === 'quota_exceeded', tripId: currentTrip?.id ?? null }]);
    }
  }

  async function undo(messageId: number, previousVersionId: string) {
    await restore.mutateAsync(previousVersionId);
    setMessages((prev) => prev.map((m) => (m.id === messageId && m.from === 'assistant' ? { ...m, undone: true } : m)));
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
            editable={canAsk}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
            onPress={() => send(input)}
            disabled={!input.trim() || !canAsk || replan.isPending}
            style={[styles.send, { backgroundColor: input.trim() && canAsk ? colors.primary : colors.surfaceMuted }]}>
            <Ionicons name="arrow-up" size={20} color={input.trim() && canAsk ? colors.onPrimary : colors.textMuted} />
          </Pressable>
        </View>
      }>
      <ModalHeader title={t('assistant.title')} subtitle={t('assistant.subtitle')} />

      {ownTrips.length > 0 && (
        <SelectSheet
          label={t('assistant.tripLabel')}
          value={currentTrip?.id ?? null}
          placeholder={t('assistant.tripPlaceholder')}
          options={ownTrips.map((x) => ({ value: x.id, label: x.title }))}
          onChange={(id) => {
            setPickedTripId(id);
            setMessages([]);
          }}
        />
      )}

      <View style={styles.quick}>
        {QUICK_ACTIONS.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            disabled={Boolean(a.step)}
            onPress={() => {
              if (a.key === 'addTicket') router.replace('/ticket');
              if (a.key === 'translate') router.replace('/translate');
              if (a.key === 'sos') router.replace('/sos');
            }}
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

      {!canAsk ? (
        <Text variant="caption" color="warning">
          {!online ? t('offline.aiUnavailable') : isSupabaseConfigured() ? t('ticket.accountRequiredBody') : t('plan.errors.not_configured')}
        </Text>
      ) : (
        !currentTrip && (
          <Text variant="caption" color="textMuted">
            {t('assistant.noTrip')}
          </Text>
        )
      )}

      {messages.length === 0 ? (
        <View style={styles.suggestions}>
          {SUGGESTIONS.map((s) => (
            <Chip key={s} label={t(`assistant.${s}`)} onPress={canAsk ? () => send(t(`assistant.${s}`)) : undefined} />
          ))}
        </View>
      ) : (
        <View style={styles.messages}>
          {messages.map((m) =>
            m.from === 'user' ? (
              <View key={m.id} style={[styles.bubble, styles.userBubble, styles.clip]}>
                <GradientBg />
                <Text variant="body" style={{ color: colors.onPrimary }}>
                  {m.text}
                </Text>
              </View>
            ) : (
              <View key={m.id} style={styles.assistantBlock}>
                <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
                  <Text variant="body">{m.text}</Text>
                </View>
                {m.upgrade && <UpgradeButton tripId={m.tripId} />}
                {m.result && m.result.suggestions.length > 0 && (
                  <View style={styles.suggestionList}>
                    <Text variant="caption" color="textSecondary">
                      {t('assistant.suggestionsTitle')}
                    </Text>
                    {m.result.suggestions.map((s, i) => (
                      <SuggestionCard key={i} item={s} />
                    ))}
                  </View>
                )}
                {m.result?.settings_updated && m.tripId && (
                  <View style={[styles.updated, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={styles.updatedRow}>
                      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                      <Text variant="bodyStrong" style={styles.flex}>
                        {t('assistant.settingsUpdated')}
                      </Text>
                    </View>
                    <View style={styles.updatedActions}>
                      <Chip icon="map-outline" label={t('assistant.viewPlan')} onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: m.tripId! } })} />
                    </View>
                  </View>
                )}
                {m.result?.plan_version_id && m.tripId && (
                  <View style={[styles.updated, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={styles.updatedRow}>
                      <Ionicons name={m.undone ? 'arrow-undo' : 'checkmark-circle'} size={18} color={m.undone ? colors.textSecondary : colors.success} />
                      <Text variant="bodyStrong" style={styles.flex}>
                        {m.undone ? t('assistant.undone') : t('assistant.planUpdated')}
                      </Text>
                    </View>
                    {!m.undone && (
                      <View style={styles.updatedActions}>
                        <Chip
                          icon="map-outline"
                          label={t('assistant.viewPlan')}
                          onPress={() => router.replace({ pathname: '/trip/[id]', params: { id: m.tripId! } })}
                        />
                        {m.result.previous_version_id && (
                          <Chip
                            icon="arrow-undo-outline"
                            label={t('assistant.undo')}
                            onPress={restore.isPending ? undefined : () => undo(m.id, m.result!.previous_version_id!)}
                          />
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            ),
          )}
          {replan.isPending && (
            <View style={[styles.bubble, styles.thinking, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="body" color="textSecondary">
                {t('assistant.thinking')}
              </Text>
            </View>
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  quick: { flexDirection: 'row', gap: Spacing.sm },
  quickItem: { flex: 1, alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  small: { fontSize: 11, lineHeight: 14 },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  messages: { gap: Spacing.md },
  bubble: { maxWidth: '88%', padding: Spacing.md, borderRadius: Radius.lg },
  userBubble: { alignSelf: 'flex-end' },
  assistantBlock: { gap: Spacing.sm, alignSelf: 'stretch' },
  thinking: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  suggestionList: { gap: Spacing.sm },
  suggestion: { flexDirection: 'row', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  time: { width: 48, fontVariant: ['tabular-nums'] },
  badges: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xxs },
  updated: { gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  updatedRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  updatedActions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, padding: Spacing.sm, paddingLeft: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  input: { flex: 1, maxHeight: 120, paddingVertical: Spacing.sm },
  send: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
});
