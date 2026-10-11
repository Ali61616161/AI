import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { DayForecast } from './api';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** Google Weather durum tipini (RAIN, PARTLY_CLOUDY...) simgeye çevirir. */
export function weatherIcon(condition: string | null): IconName {
  const c = condition ?? '';
  if (c.includes('THUNDER')) return 'thunderstorm-outline';
  if (c.includes('SNOW') || c.includes('HAIL') || c.includes('SLEET')) return 'snow-outline';
  if (c.includes('RAIN') || c.includes('SHOWER') || c.includes('DRIZZLE')) return 'rainy-outline';
  if (c.includes('PARTLY') || c === 'MOSTLY_CLEAR') return 'partly-sunny-outline';
  if (c.includes('CLOUD') || c.includes('FOG') || c.includes('HAZE')) return 'cloudy-outline';
  if (c.includes('CLEAR') || c.includes('SUNNY')) return 'sunny-outline';
  return 'partly-sunny-outline';
}

export function WeatherBadge({ forecast }: { forecast: DayForecast }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const temps = [forecast.max, forecast.min].map((v) => (v === null ? '–' : `${Math.round(v)}°`)).join(' / ');
  const rainy = forecast.rainChance !== null && forecast.rainChance >= 30;
  return (
    <View
      accessible
      accessibilityLabel={[forecast.description, temps, rainy ? t('weather.rain', { percent: forecast.rainChance }) : null].filter(Boolean).join(', ')}
      style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
      <Ionicons name={weatherIcon(forecast.condition)} size={18} color={rainy ? colors.accent : colors.warning} />
      <Text variant="bodyStrong" style={styles.temps}>
        {temps}
      </Text>
      {forecast.description && (
        <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
          {forecast.description}
        </Text>
      )}
      {rainy && (
        <Text variant="caption" style={{ color: colors.accent }}>
          {t('weather.rain', { percent: forecast.rainChance })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md },
  temps: { fontVariant: ['tabular-nums'] },
  flex: { flexShrink: 1 },
});
