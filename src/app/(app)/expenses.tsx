import Ionicons from '@expo/vector-icons/Ionicons';
import { Card } from '@/components/ui/card';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { EXPENSE_CATEGORIES, useAddExpense, useDeleteExpense, useExpenses, type ExpenseCategory, type ExpenseRow } from '@/features/tools/api';
import { settle } from '@/features/tools/settle';
import { useTrip } from '@/features/trips/queries';
import { formatMoney } from '@/lib/format';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const CATEGORY_ICONS: Record<ExpenseCategory, 'restaurant-outline' | 'bus-outline' | 'bed-outline' | 'ticket-outline' | 'bag-outline' | 'ellipsis-horizontal'> = {
  food: 'restaurant-outline',
  transport: 'bus-outline',
  accommodation: 'bed-outline',
  activity: 'ticket-outline',
  shopping: 'bag-outline',
  other: 'ellipsis-horizontal',
};

const CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY', 'CHF', 'JPY', 'CNY', 'AED', 'RUB', 'SAR'];
const inBudget = (e: ExpenseRow) => e.amount_in_budget_currency ?? e.amount;

/** Harcama takibi ve hesap bölüşme. */
export default function ExpensesScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const budget = trip?.budget_currency ?? 'EUR';
  const { data: expenses, isLoading } = useExpenses(tripId);
  const addExpense = useAddExpense(tripId, budget);
  const deleteExpense = useDeleteExpense(tripId);
  const me = t('expenses.me');

  const [adding, setAdding] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState<string | null>(null);
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [description, setDescription] = useState('');
  const [paidBy, setPaidBy] = useState(me);
  const [newPerson, setNewPerson] = useState('');
  const [extraPeople, setExtraPeople] = useState<string[]>([]);
  const [split, setSplit] = useState<string[] | null>(null);

  const people = useMemo(() => {
    const names = new Set<string>([me, ...extraPeople]);
    for (const e of expenses ?? []) {
      if (e.paid_by_name) names.add(e.paid_by_name);
      for (const s of e.expense_shares) names.add(s.participant_name);
    }
    return [...names];
  }, [expenses, extraPeople, me]);
  const splitWith = split ?? people;

  const total = (expenses ?? []).reduce((s, e) => s + inBudget(e), 0);
  const byCategory = EXPENSE_CATEGORIES.map((c) => ({ c, sum: (expenses ?? []).filter((e) => e.category === c).reduce((s, e) => s + inBudget(e), 0) })).filter((x) => x.sum > 0);
  const transfers = settle(
    (expenses ?? [])
      .filter((e) => e.expense_shares.length > 0)
      .map((e) => ({ paidBy: e.paid_by_name ?? me, amount: e.expense_shares.reduce((s, x) => s + x.share_amount, 0), shares: e.expense_shares.map((s) => ({ name: s.participant_name, amount: s.share_amount })) })),
  );

  async function save() {
    const value = Number(amount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    await addExpense.mutateAsync({ amount: value, currency: currency ?? budget, category, description, paidBy, participants: people.length > 1 ? splitWith : [] });
    setAmount('');
    setDescription('');
    setAdding(false);
  }

  return (
    <Screen
      footer={!adding ? <Button title={t('expenses.add')} onPress={() => setAdding(true)} /> : undefined}>
      <ModalHeader title={t('expenses.title')} subtitle={trip?.title} />

      <Card variant="gradient" padding={Spacing.xl}>
        <Text variant="overline" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {t('expenses.total')}
        </Text>
        <Text variant="hero" style={{ color: colors.onPrimary }}>
          {formatMoney(total, budget)}
        </Text>
      </Card>

      {byCategory.length > 0 && (
        <View style={styles.section}>
          {byCategory.map(({ c, sum }) => (
            <View key={c} style={styles.barRow}>
              <Ionicons name={CATEGORY_ICONS[c]} size={16} color={colors.textSecondary} />
              <Text variant="caption" style={styles.barLabel}>
                {t(`expenses.categories.${c}`)}
              </Text>
              <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.barFill, { width: `${Math.max(4, (sum / total) * 100)}%`, backgroundColor: colors.primary }]} />
              </View>
              <Text variant="caption" style={styles.barValue}>
                {formatMoney(sum, budget)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {adding && (
        <View style={[styles.form, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.row}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0,00"
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('expenses.amount')}
              style={[Typography.title, styles.input, styles.flex, { color: colors.text, borderColor: colors.border }]}
            />
          </View>
          <View style={styles.chips}>
            {[budget, ...CURRENCIES.filter((c) => c !== budget)].map((c) => (
              <Chip key={c} label={c} selected={(currency ?? budget) === c} onPress={() => setCurrency(c)} />
            ))}
          </View>
          <View style={styles.chips}>
            {EXPENSE_CATEGORIES.map((c) => (
              <Chip key={c} icon={CATEGORY_ICONS[c]} label={t(`expenses.categories.${c}`)} selected={category === c} onPress={() => setCategory(c)} />
            ))}
          </View>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder={t('expenses.description')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('expenses.description')}
            style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <Text variant="caption" color="textSecondary">
            {t('expenses.paidBy')}
          </Text>
          <View style={styles.chips}>
            {people.map((p) => (
              <Chip key={p} label={p} selected={paidBy === p} onPress={() => setPaidBy(p)} />
            ))}
          </View>
          <Text variant="caption" color="textSecondary">
            {t('expenses.splitWith')}
          </Text>
          <View style={styles.chips}>
            {people.map((p) => (
              <Chip key={p} icon={splitWith.includes(p) ? 'checkmark' : undefined} label={p} selected={splitWith.includes(p)} onPress={() => setSplit(splitWith.includes(p) ? splitWith.filter((x) => x !== p) : [...splitWith, p])} />
            ))}
          </View>
          <View style={styles.row}>
            <TextInput
              value={newPerson}
              onChangeText={setNewPerson}
              placeholder={t('expenses.addPerson')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('expenses.addPerson')}
              style={[Typography.body, styles.input, styles.flex, { color: colors.text, borderColor: colors.border }]}
            />
            <Button
              title="+"
              variant="secondary"
              disabled={!newPerson.trim() || people.includes(newPerson.trim())}
              onPress={() => {
                const n = newPerson.trim().slice(0, 60);
                setExtraPeople((x) => [...x, n]);
                setSplit([...splitWith, n]);
                setNewPerson('');
              }}
            />
          </View>
          {addExpense.isError && (
            <Text variant="caption" color="danger">
              {t('common.error')}
            </Text>
          )}
          <View style={styles.row}>
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} style={styles.flex} />
            <Button title={t('common.save')} loading={addExpense.isPending} disabled={!(Number(amount.replace(',', '.')) > 0)} onPress={save} style={styles.flex} />
          </View>
        </View>
      )}

      {transfers.length > 0 && (
        <View style={styles.section}>
          <Text variant="subtitle">{t('expenses.settleUp')}</Text>
          {transfers.map((x) => (
            <View key={`${x.from}-${x.to}`} style={[styles.transfer, { backgroundColor: colors.surfaceMuted }]}>
              <Text variant="bodyStrong">{x.from}</Text>
              <Ionicons name="arrow-forward" size={16} color={colors.textSecondary} />
              <Text variant="bodyStrong" style={styles.flex}>
                {x.to}
              </Text>
              <Text variant="bodyStrong">{formatMoney(x.amount, budget)}</Text>
            </View>
          ))}
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator />
      ) : !expenses?.length && !adding ? (
        <EmptyState icon="wallet-outline" title={t('expenses.emptyTitle')} description={t('expenses.emptyBody')} />
      ) : (
        <View style={styles.section}>
          {expenses?.map((e) => (
            <View key={e.id} style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
                <Ionicons name={CATEGORY_ICONS[e.category]} size={18} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <Text variant="bodyStrong">{e.description || t(`expenses.categories.${e.category}`)}</Text>
                <Text variant="caption" color="textSecondary">
                  {[e.paid_by_name, e.expense_shares.length > 1 ? t('expenses.splitCount', { count: e.expense_shares.length }) : null].filter(Boolean).join(' · ')}
                </Text>
              </View>
              <View style={styles.amount}>
                <Text variant="bodyStrong">{formatMoney(e.amount, e.currency)}</Text>
                {e.currency !== budget && e.amount_in_budget_currency !== null && (
                  <Text variant="caption" color="textMuted">
                    ≈ {formatMoney(e.amount_in_budget_currency, budget)}
                  </Text>
                )}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('expenses.delete')} onPress={() => deleteExpense.mutate(e.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  total: { gap: Spacing.xxs, padding: Spacing.lg, borderRadius: Radius.xl },
  section: { gap: Spacing.sm },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  barLabel: { width: 84 },
  barTrack: { flex: 1, height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: Radius.pill },
  barValue: { minWidth: 72, textAlign: 'right', fontVariant: ['tabular-nums'] },
  form: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  transfer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  icon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  amount: { alignItems: 'flex-end' },
});
