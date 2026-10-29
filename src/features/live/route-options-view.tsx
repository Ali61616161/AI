import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { VEHICLE_ICONS, type RouteChoice } from '@/features/transport/api';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { departureInMin, transferCount } from './route-options';

type Props = { routes: RouteChoice[]; selected: number; nowMs: number; onSelect: (index: number) => void };

/**
 * Moovit tarzı güzergah seçenekleri: konumundan hedefe süre, yürüyüş ve hat rozetleri, ilk biniş saati ve "x dk sonra".
 * Birine dokununca harita çizgisi ve süre ona göre değişir; "Yola çık" listeyi o seçenekle açar.
 */
export function RouteOptions({ routes, selected, nowMs, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="overline" color="textMuted">
        {t('live.route.title')}
      </Text>
      {routes.map((route, index) => {
        const active = index === selected;
        const leaves = departureInMin(route, nowMs);
        const transfers = transferCount(route);
        const hasTransit = route.steps.some((s) => s.transit);
        return (
          <Tap key={index} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={route.durationText ?? t('route.minutes', { count: route.durationMin })} onPress={() => onSelect(index)} feedback="select">
            <View style={[styles.row, { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border, borderWidth: active ? 2 : 1 }]}>
              <View style={styles.main}>
                <Text variant="subtitle">{t('route.minutes', { count: route.durationMin })}</Text>
                <View style={styles.legs}>
                  {route.steps.map((s, i) => (
                    <Fragment key={i}>
                      {i > 0 && <Ionicons name="chevron-forward" size={12} color={colors.textMuted} />}
                      {s.transit ? (
                        <View style={[styles.pill, { backgroundColor: s.transit.color ?? colors.primary }]}>
                          <Ionicons name={VEHICLE_ICONS[s.transit.vehicle]} size={12} color={s.transit.textColor ?? '#FFFFFF'} />
                          <Text variant="caption" numberOfLines={1} style={{ color: s.transit.textColor ?? '#FFFFFF', fontWeight: '800' }}>
                            {s.transit.lineShort ?? s.transit.line ?? t(`route.vehicle.${s.transit.vehicle}`)}
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.walk}>
                          <Ionicons name={s.mode === 'drive' ? 'car' : 'walk'} size={15} color={colors.textSecondary} />
                          <Text variant="caption" color="textSecondary">
                            {s.durationMin}
                          </Text>
                        </View>
                      )}
                    </Fragment>
                  ))}
                </View>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {[route.departAt && route.arriveAt ? `${route.departAt} → ${route.arriveAt}` : null, route.distanceText, hasTransit ? (transfers ? t('route.transfers', { count: transfers }) : t('route.direct')) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {leaves !== null && (
                <View style={styles.leave}>
                  <Text variant="bodyStrong" style={{ color: leaves < 0 ? colors.textMuted : leaves <= 5 ? colors.warning : colors.success }}>
                    {leaves < 0 ? t('live.route.departed') : leaves <= 0 ? t('live.route.now') : t('route.minutes', { count: leaves })}
                  </Text>
                  {leaves > 0 && (
                    <Text variant="caption" color="textMuted">
                      {t('live.route.leavesIn')}
                    </Text>
                  )}
                </View>
              )}
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm, marginTop: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg },
  main: { flex: 1, gap: 4 },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: Radius.pill, maxWidth: 110 },
  walk: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  leave: { alignItems: 'flex-end' },
});
