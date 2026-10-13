import { LinearGradient } from 'expo-linear-gradient';
import type { RefObject } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '@/components/brand/logo-mark';
import { Text } from '@/components/ui/text';
import { formatPercent } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';

import type { VisitedSummary } from '../../../supabase/functions/_shared/continents.ts';

/** Gezdiğim ülkeler özeti; paylaşım için görsel olarak da kaydedilir. */
export function VisitedCard({ summary, cities, cardRef }: { summary: VisitedSummary; cities: number | null; cardRef?: RefObject<View | null> }) {
  const { t } = useTranslation();
  return (
    <View ref={cardRef} collapsable={false}>
      <LinearGradient colors={['#0F1C4D', '#2E5BFF', '#2EE6C9']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View pointerEvents="none" style={styles.ring} />
        <Text variant="overline" style={styles.soft}>
          {t('visited.cardOverline')}
        </Text>
        <View style={styles.bigRow}>
          <Text variant="hero" style={styles.white}>
            {formatPercent(summary.percent)}
          </Text>
          <Text variant="body" style={[styles.soft, styles.bigLabel]}>
            {t('visited.ofWorld')}
          </Text>
        </View>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text variant="stat" style={styles.white}>
              {summary.countries}
            </Text>
            <Text variant="caption" style={styles.soft}>
              {t('visited.countries', { count: summary.countries })}
            </Text>
          </View>
          <View style={styles.stat}>
            <Text variant="stat" style={styles.white}>
              {summary.continents}/6
            </Text>
            <Text variant="caption" style={styles.soft}>
              {t('visited.continentsLabel')}
            </Text>
          </View>
          {cities !== null && (
            <View style={styles.stat}>
              <Text variant="stat" style={styles.white}>
                {cities}
              </Text>
              <Text variant="caption" style={styles.soft}>
                {t('visited.cities', { count: cities })}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.bars}>
          {summary.byContinent.map((b) => (
            <View key={b.continent} style={styles.barRow}>
              <Text variant="caption" style={[styles.soft, styles.barLabel]} numberOfLines={1}>
                {t(`visited.continents.${b.continent}`)}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(b.percent, b.visited ? 3 : 0)}%` }]} />
              </View>
              <Text variant="caption" style={[styles.white, styles.barValue]}>
                {formatPercent(b.percent)}
              </Text>
            </View>
          ))}
        </View>
        <View style={styles.foot}>
          <LogoMark size={24} withBackground={false} />
          <Text variant="caption" style={styles.soft}>
            {t('visited.footer')}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.md, overflow: 'hidden' },
  ring: { position: 'absolute', right: -70, top: -70, width: 220, height: 220, borderRadius: 110, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.85)' },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  bigLabel: { marginBottom: 6 },
  stats: { flexDirection: 'row', gap: Spacing.md },
  stat: { flex: 1, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: 'rgba(0,0,0,0.2)', gap: 2 },
  bars: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barLabel: { width: 96 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.18)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#FFFFFF' },
  barValue: { width: 44, textAlign: 'right' },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
});
