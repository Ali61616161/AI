import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import {
  managementUrl,
  PurchaseCancelled,
  purchasesAvailable,
  useCurrentPlan,
  useOfferings,
  usePurchase,
  useRestore,
  type PlanPackage,
} from '@/features/subscription/purchases';
import { useTrip } from '@/features/trips/queries';
import { formatMoney } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Row = { key: string; free: string; pro: string };

/** Yola Pro ve Trip Pass: farklar, fiyatlar, satın alma ve geri yükleme. */
export default function PaywallScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId, reason } = useLocalSearchParams<{ tripId?: string; reason?: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan } = useCurrentPlan(tripId);
  const offerings = useOfferings();
  const purchase = usePurchase();
  const restore = useRestore();
  const options = (offerings.data ?? []).filter((o) => o.plan !== 'trip_pass' || tripId);
  const [selected, setSelected] = useState<PlanPackage['plan'] | null>(null);
  const choice = options.find((o) => o.plan === (selected ?? 'pro_yearly')) ?? options[0];
  const monthly = options.find((o) => o.plan === 'pro_monthly');
  const yearly = options.find((o) => o.plan === 'pro_yearly');
  const saving = monthly && yearly && monthly.price > 0 ? Math.round((1 - yearly.price / (monthly.price * 12)) * 100) : null;
  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly';

  const rows: Row[] = [
    { key: 'itinerary', free: t('paywall.free.itinerary'), pro: t('paywall.pro.unlimitedDays') },
    { key: 'replan', free: t('paywall.free.replan'), pro: t('paywall.pro.unlimited') },
    { key: 'documents', free: t('paywall.free.documents'), pro: t('paywall.pro.unlimited') },
    { key: 'translate', free: t('paywall.free.translate'), pro: t('paywall.pro.unlimited') },
    { key: 'nearby', free: t('paywall.free.nearby'), pro: t('paywall.pro.unlimited') },
    { key: 'visa', free: t('paywall.free.visa'), pro: t('paywall.pro.unlimited') },
    { key: 'offline', free: '✓', pro: '✓' },
  ];

  async function buy() {
    if (!choice) return;
    try {
      await purchase.mutateAsync({ item: choice, tripId });
      router.back();
    } catch (e) {
      if (!(e instanceof PurchaseCancelled)) console.warn('purchase failed', e);
    }
  }

  const label = (o: PlanPackage) =>
    o.plan === 'trip_pass' ? t('paywall.tripPass') : o.plan === 'pro_monthly' ? t('paywall.monthly') : t('paywall.yearly');
  const sub = (o: PlanPackage) =>
    o.plan === 'trip_pass'
      ? t('paywall.tripPassFor', { trip: trip?.title ?? '' })
      : o.plan === 'pro_yearly'
        ? t('paywall.perMonth', { price: formatMoney(Math.round((o.price / 12) * 100) / 100, o.currency) })
        : t('paywall.cancelAnytime');

  return (
    <Screen>
      <ModalHeader title="Yola Pro" subtitle={reason === 'quota' ? t('paywall.limitReached') : t('paywall.subtitle')} />

      <View style={[styles.table, { borderColor: colors.border, backgroundColor: colors.surface }]}>
        <View style={[styles.tr, { borderColor: colors.border }]}>
          <Text variant="caption" color="textSecondary" style={styles.feature} />
          <Text variant="caption" color="textSecondary" style={styles.col}>
            {t('paywall.freeTitle')}
          </Text>
          <Text variant="caption" style={[styles.col, { color: colors.primary, fontWeight: '700' }]}>
            Pro
          </Text>
        </View>
        {rows.map((r) => (
          <View key={r.key} style={[styles.tr, { borderColor: colors.border }]}>
            <Text variant="caption" style={styles.feature}>
              {t(`paywall.features.${r.key}` as 'paywall.features.itinerary')}
            </Text>
            <Text variant="caption" color="textSecondary" style={styles.col}>
              {r.free}
            </Text>
            <Text variant="caption" style={[styles.col, { fontWeight: '600' }]}>
              {r.pro}
            </Text>
          </View>
        ))}
      </View>

      {isPro ? (
        <View style={[styles.state, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text variant="bodyStrong" style={styles.flex}>
            {t('paywall.youArePro')}
          </Text>
          <Button title={t('paywall.manage')} variant="ghost" onPress={async () => Linking.openURL((await managementUrl()) ?? (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'))} />
        </View>
      ) : !purchasesAvailable ? (
        <View style={[styles.state, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name="phone-portrait-outline" size={22} color={colors.primary} />
          <Text variant="body" style={styles.flex}>
            {Platform.OS === 'web' ? t('paywall.mobileOnly') : t('paywall.notConfigured')}
          </Text>
        </View>
      ) : offerings.isLoading ? (
        <ActivityIndicator />
      ) : (
        <>
          {options.map((o) => {
            const active = choice?.plan === o.plan;
            return (
              <Pressable
                key={o.plan}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                onPress={() => setSelected(o.plan)}
                style={[styles.option, { backgroundColor: colors.surface, borderColor: active ? colors.primary : colors.border, borderWidth: active ? 2 : 1 }]}>
                <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={22} color={active ? colors.primary : colors.textMuted} />
                <View style={styles.flex}>
                  <View style={styles.row}>
                    <Text variant="bodyStrong">{label(o)}</Text>
                    {o.plan === 'pro_yearly' && saving !== null && saving > 0 && (
                      <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                        <Text variant="caption" style={{ color: colors.onPrimary, fontWeight: '700' }}>
                          {t('paywall.save', { percent: saving })}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text variant="caption" color="textSecondary">
                    {sub(o)}
                  </Text>
                </View>
                <Text variant="bodyStrong">{o.priceString}</Text>
              </Pressable>
            );
          })}
          {purchase.isError && !(purchase.error instanceof PurchaseCancelled) && (
            <Text variant="caption" color="danger">
              {t('paywall.failed')}
            </Text>
          )}
          <Button title={choice ? t('paywall.continue', { price: choice.priceString }) : t('common.loading')} loading={purchase.isPending} disabled={!choice} onPress={buy} />
          <Button title={t('paywall.restore')} variant="ghost" loading={restore.isPending} onPress={() => restore.mutate()} />
          {restore.isSuccess && (
            <Text variant="caption" color="success">
              {restore.data.plan === 'free' ? t('paywall.nothingToRestore') : t('paywall.restored')}
            </Text>
          )}
        </>
      )}

      <Text variant="caption" color="textMuted">
        {t(Platform.OS === 'ios' ? 'paywall.legalIos' : 'paywall.legalAndroid')}
      </Text>
      <View style={styles.row}>
        <Button title={t('legal.terms')} variant="ghost" onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })} />
        <Button title={t('legal.privacy')} variant="ghost" onPress={() => router.push({ pathname: '/legal', params: { doc: 'privacy' } })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  table: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  tr: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth },
  feature: { flex: 1.4 },
  col: { flex: 1, textAlign: 'center' },
  state: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
});
