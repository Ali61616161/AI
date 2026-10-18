import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useIsOnline } from '@/features/offline/use-online';
import { CameraTranslator } from '@/features/translate/camera-translator';
import { Conversation } from '@/features/translate/conversation';
import { fromAppLanguage, languageForCountry, translateLanguage } from '@/features/translate/languages';
import { TextTranslator } from '@/features/translate/text-translator';
import { useTranslateStore } from '@/features/translate/translate-store';
import { VoicePicker } from '@/features/translate/voice-picker';
import { Chip } from '@/components/ui/chip';
import { useTrips } from '@/features/trips/queries';
import { todayIsoDate } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Tab = 'conversation' | 'text' | 'camera';
const TABS: { key: Tab; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'conversation', icon: 'mic-outline' },
  { key: 'text', icon: 'text-outline' },
  { key: 'camera', icon: 'camera-outline' },
];

/** Çeviri merkezi: canlı konuşma, metin ve kamera çevirisi. */
export default function TranslateScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'conversation');
  const [showVoices, setShowVoices] = useState(false);
  const online = useIsOnline();
  const session = useSessionStore((s) => s.session);
  const { data: trips } = useTrips();
  const store = useTranslateStore();

  // Karşı tarafın dili: önce son seçim, yoksa şu anki/sıradaki seyahatin ülkesi, yoksa İngilizce.
  const today = todayIsoDate();
  const trip = trips?.find((x) => !x.end_date || x.end_date >= today);
  const mine = store.myLanguage ?? fromAppLanguage(i18n.language);
  const guess = languageForCountry(trip?.trip_destinations[0]?.country_code);
  const theirs = store.theirLanguage ?? (guess && guess !== mine ? guess : mine === 'en' ? 'es' : 'en');
  const setLanguages = (m: string, th: string) => store.setLanguages(m, th);
  const available = Boolean(session) && isSupabaseConfigured() && online;

  return (
    <Screen>
      <ModalHeader title={t('translate.title')} subtitle={t('translate.subtitle')} />
      <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {TABS.map((x) => {
          const active = x.key === tab;
          return (
            <Pressable
              key={x.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(x.key)}
              style={[styles.tab, active && { backgroundColor: colors.surface }]}>
              <Ionicons name={x.icon} size={18} color={active ? colors.primary : colors.textSecondary} />
              <Text variant="caption" style={{ color: active ? colors.text : colors.textSecondary, fontWeight: active ? '600' : '400' }}>
                {t(`translate.tabs.${x.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.voiceRow}>
        <Chip icon="volume-high-outline" label={t('translate.voice.title')} selected={showVoices} onPress={() => setShowVoices((v) => !v)} />
      </View>
      {showVoices && <VoicePicker languages={[theirs, ...(mine === theirs ? [] : [mine])].map((c) => translateLanguage(c))} />}

      {!available && (
        <Text variant="caption" color="warning">
          {!online ? t('offline.aiUnavailable') : t('ticket.accountRequiredBody')}
        </Text>
      )}

      {tab === 'conversation' && <Conversation myLanguage={mine} theirLanguage={theirs} onLanguages={setLanguages} />}
      {tab === 'text' && <TextTranslator myLanguage={mine} theirLanguage={theirs} onLanguages={setLanguages} />}
      {tab === 'camera' && <CameraTranslator myLanguage={mine} onLanguage={(c) => setLanguages(c, theirs)} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  voiceRow: { flexDirection: 'row' },
  tabs: { flexDirection: 'row', padding: 4, borderRadius: Radius.lg },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.sm, borderRadius: Radius.md },
});
