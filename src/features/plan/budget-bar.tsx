import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { getRate } from '@/lib/fx';
import { formatMoney, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { dayBudget, type CostItem } from './budget-logic';
import { useCheaperDay, useRestoreVersion } from './replan';

export type TripBudget = { amount: number; currency: string };

/** Günün tahmini harcamasını (kişi başı) günlük bütçeyle karşılaştırır; aşarsa en pahalı kalemleri gösterir. */
export function BudgetBar({ tripId, date, items, budget, readOnly = false }: { tripId?: string; date: string; items: CostItem[]; budget: TripBudget; readOnly?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const cheaper = useCheaperDay(tripId ?? '');
  const restore = useRestoreVersion(tripId ?? '');
  const [undone, setUndone] = useState(false);
  const currencies = [...new Set(items.map((i) => i.cost_currency?.toUpperCase()).filter((c): c is string => Boolean(c) && c !== budget.currency.toUpperCase()))].sort();
  const rates = useQuery({
    queryKey: ['day-budget-rates', budget.currency, currencies.join(',')],
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const out: Record<string, number> = {};
      await Promise.all(
        currencies.map(async (code) => {
          const rate = await getRate(code, budget.currency);
          if (rate) out[code] = rate;
        }),
      );
      return out;
    },
  });
  if (rates.isLoading) return null;
  const result = dayBudget(items, budget.amount, budget.currency, rates.data ?? {});
  if (result.status === 'none') return null;
  const tone = result.status === 'over' ? colors.danger : result.status === 'near' ? colors.warning : colors.success;
  const today = todayIsoDate();
  const canAsk = Boolean(tripId) && !readOnly && date >= today;
  const askCheaper = () => {
    setUndone(false);
    cheaper.mutate({ message: t('budget.askMessage', { budget: formatMoney(budget.amount, budget.currency), total: formatMoney(result.total, budget.currency) }), date, today });
  };
  const done = cheaper.data?.plan_version_id ? cheaper.data : null;

  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceMuted, borderColor: tone }]}>
      <View style={styles.row}>
        <Text variant="bodyStrong" style={{ color: tone }}>
          {t(`budget.${result.status}`)}
        </Text>
        <Text variant="caption" color="textSecondary">
          ≈ {formatMoney(Math.round(result.total), budget.currency)} / {formatMoney(budget.amount, budget.currency)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.border }]}>
        <View style={[styles.fill, { backgroundColor: tone, width: `${Math.min(result.ratio, 1) * 100}%` }]} />
      </View>
      {result.status === 'over' && (
        <>
          <Text variant="caption" color="textSecondary">
            {t('budget.mostExpensive', { items: result.top.map((x) => `${x.title} (${formatMoney(Math.round(x.amount), budget.currency)})`).join(', ') })}
          </Text>
          {canAsk && !cheaper.isPending && !done && <Chip icon="sparkles-outline" label={t('budget.askCheaper')} onPress={askCheaper} />}
          {cheaper.isPending && (
            <View style={styles.row}>
              <ActivityIndicator color={colors.primary} />
              <Text variant="caption" color="textSecondary" style={styles.flex}>
                {t('budget.working')}
              </Text>
            </View>
          )}
          {cheaper.isError && (
            <Text variant="caption" color="danger">
              {t('budget.failed')}
            </Text>
          )}
          {done && (
            <View style={styles.row}>
              <Text variant="caption" color={undone ? 'textSecondary' : 'success'} style={styles.flex}>
                {undone ? t('assistant.undone') : t('budget.done')}
              </Text>
              {!undone && done.previous_version_id && (
                <Chip
                  icon="arrow-undo-outline"
                  label={t('assistant.undo')}
                  onPress={restore.isPending ? undefined : () => restore.mutate(done.previous_version_id!, { onSuccess: () => setUndone(true) })}
                />
              )}
            </View>
          )}
        </>
      )}
      {result.skipped > 0 && (
        <Text variant="caption" color="textMuted">
          {t('budget.skipped', { count: result.skipped })}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
});
