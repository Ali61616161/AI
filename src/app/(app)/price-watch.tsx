import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { DateField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { openBookingLink } from '@/features/places/api';
import { useAddPriceWatch, useDeletePriceWatch, usePriceWatches, useUpdatePriceWatch, type PriceWatch } from '@/features/price/api';
import { formProblem, MAX_ACTIVE_WATCHES, trend, WATCH_CURRENCIES, type WatchCurrency, type WatchForm } from '@/features/price/logic';
import { PlaceField } from '@/features/price/place-field';
import { formatDayShort, formatMoney, todayIsoDate } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const EMPTY: WatchForm = { origin: null, destination: null, depart: '', ret: '', flexible: false, target: '' };

function flightSearchUrl(w: PriceWatch): string {
  const when = w.flexible_month ? w.depart_on.slice(0, 7) : w.depart_on;
  const back = w.return_on ? ` returning ${w.flexible_month ? w.return_on.slice(0, 7) : w.return_on}` : '';
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(`Flights from ${w.origin_code} to ${w.destination_code} on ${when}${back}`)}`;
}

function Spark({ points }: { points: { d: string; p: number }[] }) {
  const { colors } = useTheme();
  if (points.length < 2) return null;
  const min = Math.min(...points.map((p) => p.p));
  const max = Math.max(...points.map((p) => p.p));
  return (
    <View style={styles.spark} accessible={false}>
      {points.slice(-20).map((p) => (
        <View key={p.d} style={[styles.bar, { height: 6 + (max === min ? 10 : ((p.p - min) / (max - min)) * 22), backgroundColor: colors.primary }]} />
      ))}
    </View>
  );
}

function WatchCard({ w }: { w: PriceWatch }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const update = useUpdatePriceWatch();
  const del = useDeletePriceWatch();
  const tr = trend(w.points);
  const reached = w.target_price !== null && w.last_price !== null && w.last_price <= w.target_price;

  function confirmDelete() {
    Alert.alert(t('priceWatch.deleteTitle'), t('priceWatch.deleteBody', { route: `${w.origin_name} → ${w.destination_name}` }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('priceWatch.delete'), style: 'destructive', onPress: () => del.mutate(w.id) },
    ]);
  }

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: reached ? colors.success : colors.border, opacity: w.active ? 1 : 0.65 }]}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text variant="bodyStrong">
            {w.origin_name} → {w.destination_name}
          </Text>
          <Text variant="caption" color="textSecondary">
            {w.flexible_month ? w.depart_on.slice(0, 7) : formatDayShort(w.depart_on)}
            {w.return_on ? ` – ${w.flexible_month ? w.return_on.slice(0, 7) : formatDayShort(w.return_on)}` : ` · ${t('priceWatch.oneWay')}`}
            {w.flexible_month ? ` · ${t('priceWatch.flexibleShort')}` : ''}
          </Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('priceWatch.delete')} hitSlop={8} onPress={confirmDelete}>
          <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      {w.last_price === null ? (
        <Text variant="caption" color="textSecondary">
          {w.last_checked_at ? t('priceWatch.noFares') : t('priceWatch.notChecked')}
        </Text>
      ) : (
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text variant="title">{formatMoney(w.last_price, w.currency)}</Text>
            <Text variant="caption" color="textSecondary">
              {t('priceWatch.lowest', { price: formatMoney(w.lowest_price ?? w.last_price, w.currency) })}
              {w.last_airline ? ` · ${w.last_airline}` : ''}
            </Text>
          </View>
          {tr && tr.trend !== 'flat' && (
            <View style={styles.row}>
              <Ionicons name={tr.trend === 'down' ? 'trending-down' : 'trending-up'} size={18} color={tr.trend === 'down' ? colors.success : colors.danger} />
              <Text variant="caption" color={tr.trend === 'down' ? 'success' : 'danger'}>
                {Math.abs(tr.pct)}%
              </Text>
            </View>
          )}
          <Spark points={w.points} />
        </View>
      )}

      <View style={styles.row}>
        {w.target_price !== null && (
          <Text variant="caption" color={reached ? 'success' : 'textSecondary'} style={styles.flex}>
            {reached ? t('priceWatch.targetReached') : t('priceWatch.target', { price: formatMoney(w.target_price, w.currency) })}
          </Text>
        )}
        {w.target_price === null && <View style={styles.flex} />}
        <Chip icon="open-outline" label={t('priceWatch.search')} onPress={() => openBookingLink(flightSearchUrl(w))} />
        <Chip
          icon={w.active ? 'pause-outline' : 'play-outline'}
          label={w.active ? t('priceWatch.pause') : t('priceWatch.resume')}
          onPress={() => update.mutate({ id: w.id, active: !w.active })}
        />
      </View>
      {update.isError && (
        <Text variant="caption" color="danger">
          {t('priceWatch.limit', { count: MAX_ACTIVE_WATCHES })}
        </Text>
      )}
    </View>
  );
}

/** Uçak bileti fiyat takibi: rota + tarih (+ hedef fiyat) kaydet; fiyat düşünce bildirim al. */
export default function PriceWatchScreen() {
  const { t } = useTranslation();
  const session = useSessionStore((s) => s.session);
  const { data: watches, isLoading } = usePriceWatches();
  const add = useAddPriceWatch();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<WatchForm>(EMPTY);
  const [currency, setCurrency] = useState<WatchCurrency>('EUR');
  const [showErrors, setShowErrors] = useState(false);

  const problem = formProblem(form, todayIsoDate());
  const activeCount = (watches ?? []).filter((w) => w.active).length;
  const set = <K extends keyof WatchForm>(key: K, value: WatchForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  function submit() {
    setShowErrors(true);
    if (problem) return;
    add.mutate(
      { form, currency },
      {
        onSuccess: () => {
          setForm(EMPTY);
          setAdding(false);
          setShowErrors(false);
        },
      },
    );
  }

  return (
    <Screen>
      <ModalHeader title={t('priceWatch.title')} subtitle={t('priceWatch.subtitle')} />

      {!session ? (
        <EmptyState icon="person-circle-outline" title={t('ticket.accountRequiredTitle')} description={t('ticket.accountRequiredBody')}>
          <Button title={t('profile.createAccount')} onPress={() => router.push('/sign-in')} />
        </EmptyState>
      ) : (
        <>
          {adding ? (
            <View style={styles.form}>
              <PlaceField label={t('priceWatch.from')} value={form.origin} onChange={(v) => set('origin', v)} />
              <PlaceField label={t('priceWatch.to')} value={form.destination} onChange={(v) => set('destination', v)} />
              <View style={styles.chips}>
                <Chip label={t('priceWatch.exactDate')} selected={!form.flexible} onPress={() => set('flexible', false)} />
                <Chip label={t('priceWatch.flexibleMonth')} selected={form.flexible} onPress={() => set('flexible', true)} />
              </View>
              <DateField
                label={t('priceWatch.depart')}
                value={form.depart}
                min={todayIsoDate()}
                hint={form.flexible ? t('priceWatch.monthHint') : undefined}
                onChange={(v) => set('depart', v)}
                error={showErrors && (problem === 'depart' || problem === 'past') ? t(problem === 'past' ? 'priceWatch.errors.past' : 'priceWatch.errors.depart') : null}
              />
              <DateField
                label={t('priceWatch.return')}
                value={form.ret}
                optional
                min={form.depart || todayIsoDate()}
                hint={t('priceWatch.returnHint')}
                onChange={(v) => set('ret', v)}
                error={showErrors && problem === 'return' ? t('priceWatch.errors.return') : null}
              />
              <View style={styles.chips}>
                {WATCH_CURRENCIES.map((c) => (
                  <Chip key={c} label={c} selected={currency === c} onPress={() => setCurrency(c)} />
                ))}
              </View>
              <TextField
                label={t('priceWatch.targetLabel')}
                value={form.target}
                onChangeText={(v) => set('target', v)}
                hint={t('priceWatch.targetHint')}
                keyboardType="decimal-pad"
                maxLength={9}
                error={showErrors && problem === 'target' ? t('priceWatch.errors.target') : null}
              />
              {showErrors && problem === 'route' && (
                <Text variant="caption" color="danger">
                  {t('priceWatch.errors.route')}
                </Text>
              )}
              {add.isError && (
                <Text variant="caption" color="danger">
                  {t('priceWatch.limit', { count: MAX_ACTIVE_WATCHES })}
                </Text>
              )}
              <Button title={t('priceWatch.save')} loading={add.isPending} onPress={submit} />
              <Button title={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
            </View>
          ) : (
            <Button title={t('priceWatch.add')} icon="add" disabled={activeCount >= MAX_ACTIVE_WATCHES} onPress={() => setAdding(true)} />
          )}
          {activeCount >= MAX_ACTIVE_WATCHES && !adding && (
            <Text variant="caption" color="textSecondary">
              {t('priceWatch.limit', { count: MAX_ACTIVE_WATCHES })}
            </Text>
          )}

          {isLoading ? (
            <ActivityIndicator />
          ) : (watches ?? []).length === 0 && !adding ? (
            <EmptyState icon="pricetag-outline" title={t('priceWatch.emptyTitle')} description={t('priceWatch.emptyBody')} />
          ) : (
            <View style={styles.list}>
              {(watches ?? []).map((w) => (
                <WatchCard key={w.id} w={w} />
              ))}
            </View>
          )}
          <Text variant="caption" color="textMuted">
            {t('priceWatch.note')}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  list: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  card: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  spark: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 28 },
  bar: { width: 3, borderRadius: 1.5 },
});
