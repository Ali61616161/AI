import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useGetaways, type GetawayResult, type Transport } from '@/features/city/api';
import { CityErrorNote } from '@/features/city/city-error';
import { nextWeekendDates } from '@/features/city/dates';
import { COMPANIONS } from '@/features/profile/options';
import { flag } from '@/features/tools/emergency-numbers';
import { TicketLinks } from '@/features/transport/ticket-links';
import { CityArt } from '@/features/trips/city-art';
import { formatMoney } from '@/lib/format';
import { useCityStore } from '@/stores/city-store';
import { useSessionStore } from '@/stores/session-store';
import { Motion, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { currencyFor } from '../../../supabase/functions/_shared/city.ts';

type IconName = ComponentProps<typeof Ionicons>['name'];
const MODE_ICON: Record<GetawayResult['travelMode'], IconName> = { bus: 'bus', train: 'train', car: 'car', ferry: 'boat', flight: 'airplane' };
const TRANSPORTS: { key: Transport; icon: IconName }[] = [
  { key: 'any', icon: 'swap-horizontal' },
  { key: 'public', icon: 'bus-outline' },
  { key: 'car', icon: 'car-outline' },
];

function GetawayCard({ g, index, days, currency, budget }: { g: GetawayResult; index: number; days: number; currency: string; budget: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const nights = Math.max(days - 1, 0);
  const fits = g.total <= budget * 1.1;
  const { start, end } = nextWeekendDates(days);
  return (
    <Animated.View entering={FadeInDown.delay(index * Motion.stagger).springify().damping(Motion.enter.damping)}>
      <Card padding={0}>
        <View style={styles.art}>
          <CityArt seed={g.city} id={`g-${index}-${g.city}`} />
          <View style={styles.artText}>
            <Text variant="title" style={styles.white} numberOfLines={1}>
              {g.countryCode ? `${flag(g.countryCode)} ` : ''}
              {g.city}
            </Text>
            <View style={styles.metaRow}>
              <Ionicons name={MODE_ICON[g.travelMode]} size={14} color="#FFFFFF" />
              <Text variant="caption" style={styles.white}>
                {t('city.travelTime', { hours: g.travelHours })} · {t('city.km', { km: g.distanceKm ?? '?' })}
              </Text>
            </View>
          </View>
          <View style={[styles.price, { backgroundColor: fits ? 'rgba(34,195,142,0.9)' : 'rgba(0,0,0,0.45)' }]}>
            <Text variant="bodyStrong" style={styles.white}>
              ~{formatMoney(g.total, currency)}
            </Text>
            <Text variant="caption" style={styles.whiteSoft}>
              {t('city.perPersonShort')}
            </Text>
          </View>
        </View>
        <View style={styles.body}>
          <Text variant="body">{g.why}</Text>
          {g.highlights.length > 0 && (
            <View style={styles.chips}>
              {g.highlights.map((h) => (
                <Chip key={h} label={h} />
              ))}
            </View>
          )}
          <View style={[styles.breakdown, { borderColor: colors.border }]}>
            <Text variant="caption" color="textSecondary">
              {t('city.costTransport', { amount: formatMoney(g.transportCost, currency) })}
            </Text>
            {nights > 0 && (
              <Text variant="caption" color="textSecondary">
                {t('city.costStay', { amount: formatMoney(g.stayPerNight, currency), count: nights })}
              </Text>
            )}
            <Text variant="caption" color="textSecondary">
              {t('city.costDaily', { amount: formatMoney(g.dailySpend, currency), count: days })}
            </Text>
          </View>
          {g.bestSeason && (
            <Text variant="caption" color="textMuted">
              {t('city.bestSeason', { season: g.bestSeason })}
            </Text>
          )}
          <View style={styles.actions}>
            <Button
              title={t('city.planIt')}
              icon="sparkles"
              size="sm"
              style={styles.flex}
              onPress={() => router.push({ pathname: '/trip-new', params: { city: g.city, country: g.countryCode ?? '', start, end } })}
            />
            <Button
              title={t('city.directions')}
              icon="navigate"
              variant="secondary"
              size="sm"
              style={styles.flex}
              onPress={() =>
                g.lat !== null && g.lng !== null
                  ? router.push({ pathname: '/route', params: { toLat: String(g.lat), toLng: String(g.lng), toName: g.city, country: g.countryCode ?? '' } })
                  : Linking.openURL(g.directionsUrl)
              }
            />
          </View>
          <TicketLinks options={g.tickets ?? []} showModes />
        </View>
      </Card>
    </Animated.View>
  );
}

/** Şehrim: yakın, bütçeye uygun kaçamaklar (mesafeler gerçek koordinatla kontrol edilir). */
export default function GetawayScreen() {
  const { t } = useTranslation();
  const identity = useSessionStore((s) => s.identity);
  const preferences = useSessionStore((s) => s.preferences);
  const saved = useCityStore((s) => s.getaways);
  const setSaved = useCityStore((s) => s.setGetaways);
  const currency = currencyFor(identity.homeCountry);
  const [days, setDays] = useState(saved?.days ?? 2);
  const [budget, setBudget] = useState(String(saved?.budget_per_person ?? ''));
  const [transport, setTransport] = useState<Transport>('any');
  const [companion, setCompanion] = useState<string>(preferences.companion ?? 'friends');
  const [editing, setEditing] = useState(!saved);
  const search = useGetaways();
  const amount = Number(budget.replace(/[^\d]/g, ''));

  function run(exclude: string[] = []) {
    search.mutate(
      { days, budget_per_person: amount, transport, companion, exclude },
      {
        onSuccess: (data) => {
          setSaved({ ...data, createdAt: new Date().toISOString() });
          setEditing(false);
        },
      },
    );
  }

  const result = !editing ? saved : null;

  return (
    <Screen
      footer={
        editing ? (
          <Button title={search.isPending ? t('city.searching') : t('city.findGetaways')} icon="compass" disabled={!amount} loading={search.isPending} onPress={() => run()} />
        ) : (
          <>
            <Button title={t('city.moreGetaways')} icon="refresh" loading={search.isPending} onPress={() => run(result?.getaways.map((g) => g.city) ?? [])} />
            <Button title={t('city.changeFilters')} variant="ghost" onPress={() => setEditing(true)} />
          </>
        )
      }>
      <ModalHeader title={t('city.getawayTitle')} subtitle={identity.homeCity ? t('city.fromCity', { city: identity.homeCity }) : t('city.getawaySubtitle')} />

      {editing ? (
        <>
          <View style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t('city.howLong')}
            </Text>
            <View style={styles.chips}>
              {[1, 2, 3].map((d) => (
                <Chip key={d} label={t('city.daysOption', { count: d })} selected={days === d} onPress={() => setDays(d)} />
              ))}
            </View>
          </View>
          <TextField
            label={t('city.budgetPerPerson', { currency })}
            value={budget}
            onChangeText={(v) => setBudget(v.replace(/[^\d]/g, '').slice(0, 8))}
            keyboardType="number-pad"
            placeholder={currency === 'TRY' ? '5000' : '200'}
            hint={t('city.budgetHint')}
          />
          <View style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t('city.transport')}
            </Text>
            <View style={styles.chips}>
              {TRANSPORTS.map((m) => (
                <Chip key={m.key} icon={m.icon} label={t(`city.transportOptions.${m.key}`)} selected={transport === m.key} onPress={() => setTransport(m.key)} />
              ))}
            </View>
          </View>
          <View style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t('city.withWho')}
            </Text>
            <View style={styles.chips}>
              {COMPANIONS.map((c) => (
                <Chip key={c.value} icon={c.icon} label={t(`companion.${c.value}`)} selected={companion === c.value} onPress={() => setCompanion(c.value)} />
              ))}
            </View>
          </View>
          {search.isPending && <Skeleton height={220} radius={Radius.xl} />}
          {search.isError && <CityErrorNote error={search.error} />}
          {saved && !search.isPending && <Button title={t('city.backToResults')} variant="ghost" onPress={() => setEditing(false)} />}
        </>
      ) : (
        result && (
          <>
            {search.isError && <CityErrorNote error={search.error} />}
            <Text variant="caption" color="textSecondary">
              {t('city.resultsFor', { days: t('city.daysOption', { count: result.days }), amount: formatMoney(result.budget_per_person, result.currency) })}
            </Text>
            {result.getaways.length === 0 ? (
              <Card>
                <Text variant="body">{t('city.noGetaways')}</Text>
              </Card>
            ) : (
              result.getaways.map((g, i) => <GetawayCard key={g.city} g={g} index={i} days={result.days} currency={result.currency} budget={result.budget_per_person} />)
            )}
            <Text variant="caption" color="textMuted">
              {t('city.estimateNote')}
            </Text>
          </>
        )
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  group: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  art: { height: 150, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden', justifyContent: 'flex-end', padding: Spacing.lg },
  artText: { gap: 4, paddingRight: 110 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { position: 'absolute', top: Spacing.md, right: Spacing.md, alignItems: 'flex-end', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.md },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.85)' },
  body: { padding: Spacing.lg, gap: Spacing.sm },
  breakdown: { borderTopWidth: 1, paddingTop: Spacing.sm, gap: 2 },
  actions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.xs },
});
