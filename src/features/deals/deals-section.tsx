import { router } from 'expo-router';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { IconBadge } from '@/components/ui/icon-badge';
import { Text } from '@/components/ui/text';
import { flag } from '@/features/tools/emergency-numbers';
import { formatDayShort } from '@/lib/format';
import { isDealUrl } from '@/lib/safe-url';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { dealsCityTerm, useDeals, type DealItem } from './api';

const addDays = (iso: string, days: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/**
 * Bugün sekmesinde "Yaşadığın şehirden fırsatlar": en ucuz uçuş bulunan yerler. Kart bilet sitesini açar,
 * "Planla" seyahat oluşturmayı şehir ve tarihlerle başlatır. Şehir seçilmemişse seçtirir.
 */
export function DealsSection() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const homeCity = useSessionStore((s) => s.identity.homeCity);
  const deals = useDeals(i18n.language);

  if (!homeCity) {
    return (
      <Card variant="solid" onPress={() => router.push('/home-city')} accessibilityLabel={t('deals.setCity')}>
        <View style={styles.row}>
          <IconBadge icon="pricetag" tone="gradient" />
          <View style={styles.flex}>
            <Text variant="bodyStrong">{t('deals.setCity')}</Text>
            <Text variant="caption" color="textSecondary">
              {t('deals.setCityBody')}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  const list = deals.data?.deals ?? [];
  if (deals.isPending || list.length === 0) return null;
  const currency = deals.data?.currency ?? 'EUR';
  const money = new Intl.NumberFormat(i18n.language, { style: 'currency', currency, maximumFractionDigits: 0 });

  const open = (d: DealItem) => {
    if (isDealUrl(d.url)) Linking.openURL(d.url).catch(() => undefined);
  };
  const plan = (d: DealItem) =>
    router.push({ pathname: '/trip-new', params: { city: d.city, country: d.country_code ?? '', start: d.depart_on, end: d.return_on ?? addDays(d.depart_on, 3) } });

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text variant="title" style={styles.flex}>
          {t('deals.title', { city: deals.data?.origin?.name ?? dealsCityTerm(homeCity) })}
        </Text>
        <Chip icon="location-outline" label={t('deals.change')} onPress={() => router.push('/home-city')} />
      </View>
      <Text variant="caption" color="textMuted">
        {t('deals.subtitle')}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cards}>
        {list.map((d) => (
          <View key={`${d.code}-${d.depart_on}`} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text variant="subtitle" numberOfLines={1}>
              {d.country_code ? `${flag(d.country_code)}  ` : ''}
              {d.city}
            </Text>
            <Text variant="caption" color="textSecondary" numberOfLines={1}>
              {formatDayShort(d.depart_on)}
              {d.return_on ? ` – ${formatDayShort(d.return_on)}` : ''}
            </Text>
            <Text variant="stat" style={{ color: colors.primary }}>
              {t('deals.from', { price: money.format(d.price) })}
            </Text>
            <View style={styles.actions}>
              <Button title={t('deals.viewFlight')} size="sm" onPress={() => open(d)} style={styles.flex} />
              <Button title={t('deals.plan')} size="sm" variant="secondary" onPress={() => plan(d)} style={styles.flex} />
            </View>
          </View>
        ))}
      </ScrollView>
      <Text variant="caption" color="textMuted">
        {t('deals.priceNote')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  cards: { gap: Spacing.sm, paddingRight: Spacing.lg },
  card: { width: 232, gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
