import { forwardRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '@/components/brand/logo-mark';
import { Text } from '@/components/ui/text';
import { formatDateRange, formatMoney } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { TripReportRow } from './api';

/** Paylaşılabilir seyahat kartı (görsel olarak kaydedilip paylaşılır). */
export const ShareCard = forwardRef<View, { title: string; start: string | null; end: string | null; report: TripReportRow }>(function ShareCard(
  { title, start, end, report },
  ref,
) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const s = report.stats;
  const tiles = [
    { value: String(s.days), label: t('report.stats.days', { count: s.days }) },
    { value: String(s.visited || s.places), label: t('report.stats.places', { count: s.visited || s.places }) },
    ...(s.distanceKm > 0 ? [{ value: `${s.distanceKm}`, label: t('report.stats.km') }] : []),
    ...(s.spent > 0 ? [{ value: formatMoney(s.spent, s.currency ?? 'EUR'), label: t('report.stats.spent') }] : []),
  ];
  return (
    <View ref={ref} collapsable={false} style={[styles.card, { backgroundColor: colors.primary }]}>
      <View style={styles.top}>
        <Text variant="caption" style={{ color: colors.onPrimary, opacity: 0.85 }}>
          {formatDateRange(start, end)}
        </Text>
        <LogoMark size={32} withBackground={false} />
      </View>
      <Text variant="display" style={{ color: colors.onPrimary }} numberOfLines={2}>
        {title}
      </Text>
      {report.overall_rating !== null && (
        <Text variant="title" style={{ color: colors.onPrimary }}>
          {'★'.repeat(report.overall_rating)}
          {'☆'.repeat(5 - report.overall_rating)}
        </Text>
      )}
      <View style={styles.tiles}>
        {tiles.map((x) => (
          <View key={x.label} style={[styles.tile, { backgroundColor: 'rgba(255,255,255,0.18)' }]}>
            <Text variant="title" style={{ color: colors.onPrimary }} numberOfLines={1}>
              {x.value}
            </Text>
            <Text variant="caption" style={{ color: colors.onPrimary }}>
              {x.label}
            </Text>
          </View>
        ))}
      </View>
      {report.ai_insights?.highlights?.length ? (
        <Text variant="body" style={{ color: colors.onPrimary }}>
          {report.ai_insights.highlights.join(' · ')}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { gap: Spacing.md, padding: Spacing.xl, borderRadius: Radius.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 2, padding: Spacing.md, borderRadius: Radius.lg },
});
