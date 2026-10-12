import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Linking, Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconBadge } from '@/components/ui/icon-badge';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
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
import { Gradients, Radius, Spacing } from '@/theme/tokens';
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
    { key: 'noAds', free: t('paywall.free.noAds'), pro: t('paywall.pro.noAds') },
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
      <ModalHeader title="" />
      <View style={styles.hero}>
        <View style={styles.badgeGlow}>
          <LinearGradient colors={Gradients.sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroBadge}>
            <Ionicons name="diamond" size={34} color="#FFFFFF" />
          </LinearGradient>
        </View>
        <Text variant="hero" style={styles.centerText}>
          Yola Pro
        </Text>
        <Text variant="body" color="textSecondary" style={styles.centerText}>
          {reason === 'quota' ? t('paywall.limitReached') : t('paywall.subtitle')}
        </Text>
      </View>

      <Card padding={Spacing.sm}>
        {rows.map((r, i) => (
          <View key={r.key} style={[styles.benefit, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border }]}>
            <IconBadge icon={BENEFIT_ICONS[r.key] ?? 'checkmark'} size={38} />
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t(`paywall.features.${r.key}` as 'paywall.features.itinerary')}</Text>
              <Text variant="caption" color="textMuted">
                {t('paywall.freeTitle')}: {r.free}
              </Text>
            </View>
            <Text variant="caption" color="primary" style={styles.proValue} numberOfLines={2}>
              {r.pro}
            </Text>
          </View>
        ))}
      </Card>

      {isPro ? (
        <View style={[styles.state, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          <Text variant="bodyStrong" style={styles.flex}>
            {t('paywall.youArePro')}
          </Text>
          <Button title={t('paywall.manage')} variant="ghost" onPress={async () => Linking.openURL((await managementUrl()) ?? (Platform.OS === 'ios' ? 'https://apps.apple.com/account/subscriptions' : 'https://play.google.com/store/account/subscriptions'))} />
        </View>
      ) : !purchasesAvailable ? (
        <View style={[styles.state, { backgroundColor: colors.surface, borderColor: colors.border }]}>
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
              <Tap key={o.plan} accessibilityRole="radio" accessibilityState={{ checked: active }} onPress={() => setSelected(o.plan)} feedback="select" scaleTo={0.98}>
                <Card variant={active ? 'glow' : 'glass'} padding={Spacing.lg}>
                  <View style={styles.row}>
                    <View style={[styles.radio, { borderColor: active ? colors.primary : colors.borderStrong }]}>{active && <View style={[styles.radioDot, { backgroundColor: colors.primary }]} />}</View>
                    <View style={styles.flex}>
                      <View style={styles.row}>
                        <Text variant="bodyStrong">{label(o)}</Text>
                        {o.plan === 'pro_yearly' && saving !== null && saving > 0 && (
                          <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.badge}>
                            <Text variant="caption" style={styles.white}>
                              {t('paywall.save', { percent: saving })}
                            </Text>
                          </LinearGradient>
                        )}
                      </View>
                      <Text variant="caption" color="textSecondary">
                        {sub(o)}
                      </Text>
                    </View>
                    <Text variant="subtitle">{o.priceString}</Text>
                  </View>
                </Card>
              </Tap>
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

const BENEFIT_ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  itinerary: 'sparkles',
  replan: 'refresh',
  documents: 'document-text',
  translate: 'language',
  nearby: 'location',
  visa: 'airplane',
  offline: 'cloud-offline',
  noAds: 'ban',
};

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.sm, marginTop: -Spacing.xl },
  badgeGlow: { borderRadius: 30, shadowColor: '#FF6B4A', shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 10 }, elevation: 10, marginBottom: Spacing.sm },
  heroBadge: { width: 84, height: 84, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.3)' },
  centerText: { textAlign: 'center' },
  benefit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.md },
  proValue: { maxWidth: 96, textAlign: 'right' },
  state: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  white: { color: '#FFFFFF' },
});
