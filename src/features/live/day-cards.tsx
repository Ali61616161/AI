import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import type { DayForecast } from '@/features/places/api';
import { weatherIcon } from '@/features/places/weather-badge';
import { formatTime } from '@/lib/format';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { LiveStopRow } from './live-hero';

/** Sabah kartı: günün özeti ve tek dokunuşla "günü başlat". */
export function DayStartCard({ count, first, weather, timezone, onStart }: { count: number; first: LiveStopRow | null; weather: DayForecast | null; timezone: string | null; onStart: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Card variant="glow" padding={Spacing.lg}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="title">{t('live.day.startTitle')}</Text>
          <Text variant="caption" color="textSecondary">
            {first ? t('live.day.startBody', { count, title: first.title, time: first.starts_at ? formatTime(first.starts_at, timezone) : '–' }) : t('live.day.startBodyNoFirst', { count })}
          </Text>
        </View>
        {weather && (weather.max !== null || weather.condition) && (
          <View style={styles.weather}>
            <Ionicons name={weatherIcon(weather.condition)} size={20} color={weather.rainChance !== null && weather.rainChance >= 30 ? colors.accent : colors.warning} />
            {weather.max !== null && <Text variant="bodyStrong">{Math.round(weather.max)}°</Text>}
          </View>
        )}
      </View>
      <Button title={t('live.day.start')} icon="sunny" onPress={onStart} style={styles.btn} />
    </Card>
  );
}

/** Gün sonu kartı: yapılanlar, günlüğe ve harcamaya kısayol, "günü bitir". */
export function DayEndCard({ done, skipped, left, onJournal, onExpense, onFinish }: { done: number; skipped: number; left: number; onJournal: () => void; onExpense: () => void; onFinish: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="glow" padding={Spacing.lg}>
      <Text variant="title">{t('live.day.endTitle')}</Text>
      <Text variant="caption" color="textSecondary">
        {t('live.day.summary', { done, skipped, left })}
      </Text>
      <View style={styles.actions}>
        <Button title={t('live.day.journal')} icon="book-outline" variant="secondary" onPress={onJournal} style={styles.flex} />
        <Button title={t('live.day.expense')} icon="wallet-outline" variant="secondary" onPress={onExpense} style={styles.flex} />
      </View>
      <Button title={t('live.day.finish')} icon="moon" onPress={onFinish} style={styles.btn} />
    </Card>
  );
}

/** Gün bitince: kısa özet ve yeniden açma. */
export function DayEndedCard({ done, skipped, onJournal, onReopen }: { done: number; skipped: number; onJournal: () => void; onReopen: () => void }) {
  const { t } = useTranslation();
  return (
    <Card variant="glow" padding={Spacing.lg}>
      <Text variant="title">{t('live.day.endedTitle')}</Text>
      <Text variant="caption" color="textSecondary">
        {t('live.day.endedBody', { done, skipped })}
      </Text>
      <View style={styles.actions}>
        <Button title={t('live.day.journal')} icon="book-outline" onPress={onJournal} style={styles.flex} />
        <Button title={t('live.day.reopen')} variant="secondary" onPress={onReopen} style={styles.flex} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  weather: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  btn: { marginTop: Spacing.md },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
});
