import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { GradientBg } from '@/components/ui/gradient-bg';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { useTripWeather } from '@/features/places/api';
import { usePacking, usePackingMutations, useProfileCountries, type PackingRow } from '@/features/tools/api';
import { buildPackingLabelIndex, normalizePackingLabel, suggestPacking, type PackingCategory } from '@/features/tools/packing';
import { resources } from '@/i18n';
import { isShopUrl } from '@/lib/safe-url';
import { useAffiliateConfig } from '@/features/affiliate/use-affiliate-config';
import { shopUrl, SHOPPABLE_KEYS } from '@/features/shop/links';
import { useActivePlan, useTrip } from '@/features/trips/queries';
import { daysUntil } from '@/lib/format';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useSessionStore } from '@/stores/session-store';
import { useTheme } from '@/theme/use-theme';

const ORDER: PackingCategory[] = ['documents', 'clothes', 'toiletries', 'health', 'electronics', 'kids', 'extras'];

function Row({ item, name, onToggle, onRemove, onShop, readOnly }: { item: PackingRow; name: string; onToggle: () => void; onRemove: () => void; onShop?: () => void; readOnly: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
    return (
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: item.is_packed, disabled: readOnly }}
          disabled={readOnly}
          onPress={onToggle}
          style={styles.check}>
          <Ionicons name={item.is_packed ? 'checkbox' : 'square-outline'} size={22} color={item.is_packed ? colors.success : colors.textSecondary} />
          <Text variant="body" style={[styles.flex, item.is_packed && { textDecorationLine: 'line-through', color: colors.textMuted }]}>
            {name}
            {item.quantity > 1 ? ` ×${item.quantity}` : ''}
          </Text>
        </Pressable>
        {onShop && !item.is_packed && (
          <Pressable accessibilityRole="link" accessibilityLabel={t('packing.shop', { item: name })} onPress={onShop} hitSlop={8}>
            <Ionicons name="cart-outline" size={20} color={colors.primary} />
          </Pressable>
        )}
        {!readOnly && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('packing.remove', { item: name })} onPress={onRemove} hitSlop={8}>
            <Ionicons name="close" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
    );
  }


/** Bavul listesi: seyahate göre akıllı öneri, işaretleme ve kendi eşyalarını ekleme. */
export default function PackingScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan } = useActivePlan(tripId);
  const { data: weather } = useTripWeather(tripId);
  const { data: profile } = useProfileCountries();
  const { data: items, isLoading } = usePacking(tripId);
  const { add, toggle, remove } = usePackingMutations(tripId);
  // Paylaşılan seyahatte görüntüleyen listeyi görür ama değiştiremez (sunucu da reddeder).
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);
  const readOnly = Boolean(trip && trip.owner_id !== userId);
  const [label, setLabel] = useState('');
  // Önerilen eşyalar kayıt anındaki dilde saklanır; gösterirken güncel dildeki adına çevrilir (kendi eklediklerin olduğu gibi kalır).
  const labelIndex = useMemo(() => buildPackingLabelIndex(Object.values(resources).map((r) => (r.translation as { packing: { items: Record<string, string> } }).packing.items)), []);
  const affiliate = useAffiliateConfig();
  const identityCountry = useSessionStore((s) => s.identity.homeCountry);
  // Satın alınabilecek eşyalarda sepet simgesi: Amazon'da arama sayfasını açar (yaşadığın ülkenin mağazası).
  const shopHandler = (item: PackingRow): (() => void) | undefined => {
    const key = labelIndex.get(normalizePackingLabel(item.label));
    if (!key || item.source !== 'ai' || !SHOPPABLE_KEYS.has(key)) return undefined;
    return () => {
      const url = shopUrl(t(`packing.items.${key}` as 'packing.items.passport'), { homeCountry: profile?.home_country ?? identityCountry, language: i18n.language, tags: affiliate.data?.amazon });
      if (isShopUrl(url)) Linking.openURL(url).catch(() => undefined);
    };
  };
  const labelOf = (item: PackingRow): string => {
    const key = item.source === 'ai' ? labelIndex.get(normalizePackingLabel(item.label)) : undefined;
    return key ? t(`packing.items.${key}` as 'packing.items.passport') : item.label;
  };

  function generate() {
    if (!trip) return;
    const days = weather?.days ?? [];
    const temps = (k: 'min' | 'max') => days.map((d) => d[k]).filter((v): v is number => v !== null);
    const destination = trip.trip_destinations[0]?.country_code ?? null;
    const suggestions = suggestPacking({
      nights: trip.start_date && trip.end_date ? Math.max(daysUntil(trip.end_date, new Date(`${trip.start_date}T12:00:00`)), 0) : 3,
      minTemp: temps('min').length ? Math.min(...temps('min')) : null,
      maxTemp: temps('max').length ? Math.max(...temps('max')) : null,
      rainChance: days.length ? Math.max(...days.map((d) => d.rainChance ?? 0)) : null,
      companion: (trip.companion_type as 'solo') ?? null,
      children: trip.children ?? 0,
      interests: trip.interests ?? [],
      hasOutdoor: Boolean(plan?.day_plans.some((d) => d.plan_items.some((i) => i.is_indoor === false))),
      hasFlight: trip.reservations.some((r) => r.type === 'flight'),
      international: !profile?.home_country || !destination || profile.home_country !== destination,
    });
    add.mutate(suggestions.map((s) => ({ label: t(`packing.items.${s.key}` as 'packing.items.passport'), category: s.category, quantity: s.quantity, source: 'ai' as const })));
  }

  const packed = items?.filter((i) => i.is_packed).length ?? 0;
  const groups = ORDER.map((c) => ({ c, rows: (items ?? []).filter((i) => (i.category ?? 'extras') === c) })).filter((g) => g.rows.length);
  const other = (items ?? []).filter((i) => i.category && !ORDER.includes(i.category as PackingCategory));

  return (
    <Screen>
      <ModalHeader title={t('packing.title')} subtitle={items?.length ? t('packing.progress', { packed, total: items.length }) : trip?.title} />

      {items && items.length > 0 && (
        <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
          <View style={[styles.fill, { width: `${(packed / items.length) * 100}%`, backgroundColor: colors.success }]} />
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator />
      ) : !items?.length ? (
        <EmptyState icon="briefcase-outline" title={t('packing.emptyTitle')} description={t('packing.emptyBody')}>
          {!readOnly && <Button title={t('packing.generate')} loading={add.isPending} onPress={generate} disabled={!trip} />}
        </EmptyState>
      ) : (
        <>
          {groups.map((g) => (
            <View key={g.c} style={styles.section}>
              <Text variant="subtitle">{t(`packing.categories.${g.c}`)}</Text>
              {g.rows.map((i) => (
                <Row key={i.id} item={i} name={labelOf(i)} onShop={shopHandler(i)} onToggle={() => toggle.mutate(i)} onRemove={() => remove.mutate(i.id)} readOnly={readOnly} />
              ))}
            </View>
          ))}
          {other.map((i) => (
            <Row key={i.id} item={i} name={labelOf(i)} onShop={shopHandler(i)} onToggle={() => toggle.mutate(i)} onRemove={() => remove.mutate(i.id)} readOnly={readOnly} />
          ))}
        </>
      )}

      {!readOnly && (
      <View style={styles.addRow}>
        <TextInput
          value={label}
          onChangeText={setLabel}
          placeholder={t('packing.addPlaceholder')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('packing.addPlaceholder')}
          style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />
        <Tap
          accessibilityRole="button"
          accessibilityLabel={t('packing.add')}
          disabled={!label.trim()}
          feedback="press"
          onPress={() => {
            add.mutate([{ label: label.trim().slice(0, 80), category: 'extras', quantity: 1, source: 'manual' }]);
            setLabel('');
          }}>
          <View style={styles.addButton}>
            <GradientBg />
            <Ionicons name="add" size={26} color="#FFFFFF" />
          </View>
        </Tap>
      </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: 8 },
  section: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  check: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  addRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  input: { flex: 1, minHeight: 54, paddingHorizontal: Spacing.lg, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2 },
  addButton: { width: 54, height: 54, borderRadius: 27, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
