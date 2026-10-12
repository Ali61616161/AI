import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
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
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { useEveningPlan, type EveningStop, type Mood, type StopKind, type When } from '@/features/city/api';
import { CityErrorNote } from '@/features/city/city-error';
import { PlaceActions } from '@/features/city/place-actions';
import { openInMaps } from '@/features/places/api';
import { PlaceMeta } from '@/features/places/place-row';
import { BUDGETS, COMPANIONS } from '@/features/profile/options';
import { formatMoney } from '@/lib/format';
import { useCityStore } from '@/stores/city-store';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Motion, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
const WHEN: When[] = ['tonight', 'tomorrow', 'weekend'];
const MOODS: { key: Mood; icon: IconName }[] = [
  { key: 'romantic', icon: 'heart-outline' },
  { key: 'chill', icon: 'cafe-outline' },
  { key: 'food', icon: 'restaurant-outline' },
  { key: 'culture', icon: 'library-outline' },
  { key: 'active', icon: 'bicycle-outline' },
  { key: 'outdoor', icon: 'leaf-outline' },
  { key: 'nightlife', icon: 'musical-notes-outline' },
  { key: 'budget', icon: 'wallet-outline' },
];
const KIND_ICON: Record<StopKind, IconName> = {
  meal: 'restaurant',
  drink: 'wine',
  dessert: 'ice-cream',
  activity: 'sparkles',
  walk: 'walk',
  culture: 'library',
  nightlife: 'musical-notes',
};

/** Durakları sırayla gezen yürüyüş rotası (Google Haritalar, anahtar gerekmez). */
function routeUrl(stops: EveningStop[]) {
  const points = stops.map((s) => (s.lat != null && s.lng != null ? `${s.lat},${s.lng}` : s.place_name));
  if (points.length < 2) return null;
  const params = new URLSearchParams({ api: '1', origin: points[0], destination: points[points.length - 1], travelmode: 'walking' });
  if (points.length > 2) params.set('waypoints', points.slice(1, -1).join('|'));
  return `https://www.google.com/maps/dir/?${params}`;
}

function StopCard({ stop, index, last, currency }: { stop: EveningStop; index: number; last: boolean; currency: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Animated.View entering={FadeInDown.delay(index * Motion.stagger).springify().damping(Motion.enter.damping)} style={styles.stopRow}>
      <View style={styles.rail}>
        <LinearGradient colors={Gradients.primary} style={styles.railDot}>
          <Ionicons name={KIND_ICON[stop.kind]} size={16} color="#FFFFFF" />
        </LinearGradient>
        {!last && <View style={[styles.railLine, { backgroundColor: colors.border }]} />}
      </View>
      <Card style={styles.flex}>
        <View style={styles.stopHead}>
          {stop.time ? (
            <Text variant="overline" color="primary">
              {stop.time}
              {stop.duration_min ? ` · ${t('city.minutes', { count: stop.duration_min })}` : ''}
            </Text>
          ) : null}
          {stop.est_cost !== null && (
            <Text variant="caption" color="textSecondary">
              {stop.est_cost === 0 ? t('city.free') : `~${formatMoney(stop.est_cost, currency)}`}
            </Text>
          )}
        </View>
        <Text variant="subtitle">{stop.title}</Text>
        <Tap accessibilityRole="link" onPress={() => openInMaps({ name: stop.place_name, mapsUrl: stop.maps_url, placeId: stop.google_place_id, lat: stop.lat, lng: stop.lng })} feedback="select">
          <View style={styles.placeLine}>
            <Ionicons name="location" size={14} color={colors.accent} />
            <Text variant="bodyStrong" style={styles.flex} numberOfLines={1}>
              {stop.place_name}
              {stop.neighborhood ? <Text variant="caption" color="textMuted">{`  ·  ${stop.neighborhood}`}</Text> : null}
            </Text>
            <Ionicons name="navigate-outline" size={16} color={colors.primary} />
          </View>
        </Tap>
        <PlaceMeta rating={stop.rating} ratingCount={stop.rating_count} priceLevel={null} distanceM={null} />
        <Text variant="body" color="textSecondary">
          {stop.why}
        </Text>
        <PlaceActions place={stop.google_place_id ? { google_place_id: stop.google_place_id, name: stop.place_name, category: stop.kind, address: stop.address, lat: stop.lat, lng: stop.lng, maps_url: stop.maps_url } : null} />
      </Card>
    </Animated.View>
  );
}

/** Şehrim: "Bu akşam ne yapsak?" — AI planı, Google ile doğrulanmış duraklar. */
export default function EveningScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const preferences = useSessionStore((s) => s.preferences);
  const homeCity = useSessionStore((s) => s.identity.homeCity);
  const saved = useCityStore((s) => s.evening);
  const setSaved = useCityStore((s) => s.setEvening);
  const [when, setWhen] = useState<When>(() => (new Date().getDay() % 6 === 0 ? 'weekend' : 'tonight'));
  const [companion, setCompanion] = useState<string>(preferences.companion ?? 'couple');
  const [budget, setBudget] = useState<string>(preferences.budget ?? 'mid');
  const [moods, setMoods] = useState<Mood[]>([]);
  const [editing, setEditing] = useState(!saved);
  const plan = useEveningPlan();

  function toggleMood(m: Mood) {
    setMoods((cur) => (cur.includes(m) ? cur.filter((x) => x !== m) : cur.length >= 3 ? cur : [...cur, m]));
  }

  function generate() {
    plan.mutate(
      { when, companion, budget, moods },
      {
        onSuccess: (data) => {
          setSaved({ ...data, when, createdAt: new Date().toISOString() });
          setEditing(false);
        },
      },
    );
  }

  const result = !editing ? saved : null;
  const total = result?.stops.reduce((n, s) => n + (s.est_cost ?? 0), 0) ?? 0;
  const route = result ? routeUrl(result.stops) : null;

  return (
    <Screen
      footer={
        editing ? (
          <Button title={plan.isPending ? t('city.planning') : t('city.makePlan')} icon="sparkles" loading={plan.isPending} onPress={generate} />
        ) : (
          <Button title={t('city.newPlan')} variant="secondary" icon="refresh" onPress={() => setEditing(true)} />
        )
      }>
      <ModalHeader title={t('city.eveningTitle')} subtitle={homeCity ? t('city.inCity', { city: homeCity }) : t('city.eveningSubtitle')} />

      {editing ? (
        <>
          <View style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t('city.when')}
            </Text>
            <View style={styles.chips}>
              {WHEN.map((w) => (
                <Chip key={w} label={t(`city.whenOptions.${w}`)} selected={when === w} onPress={() => setWhen(w)} />
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
          <View style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t('profile.budget')}
            </Text>
            <View style={styles.chips}>
              {BUDGETS.map((b) => (
                <Chip key={b.value} icon={b.icon} label={t(`budget.${b.value}`)} selected={budget === b.value} onPress={() => setBudget(b.value)} />
              ))}
            </View>
          </View>
          <View style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t('city.mood')}
            </Text>
            <View style={styles.chips}>
              {MOODS.map((m) => (
                <Chip key={m.key} icon={m.icon} label={t(`city.moods.${m.key}`)} selected={moods.includes(m.key)} onPress={() => toggleMood(m.key)} />
              ))}
            </View>
          </View>
          {plan.isPending && (
            <View style={styles.group}>
              <Skeleton height={120} />
              <Skeleton height={120} />
            </View>
          )}
          {plan.isError && <CityErrorNote error={plan.error} />}
          {saved && !plan.isPending && <Button title={t('city.backToPlan')} variant="ghost" onPress={() => setEditing(false)} />}
        </>
      ) : (
        result && (
          <>
            <LinearGradient colors={Gradients.sunset} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
              <Text variant="overline" style={styles.whiteSoft}>
                {t(`city.whenOptions.${result.when as When}`)} · {result.city}
              </Text>
              <Text variant="title" style={styles.white}>
                {result.title}
              </Text>
              {result.summary ? (
                <Text variant="body" style={styles.whiteSoft}>
                  {result.summary}
                </Text>
              ) : null}
              <View style={styles.heroPills}>
                {result.weather?.temperature != null && (
                  <View style={styles.pill}>
                    <Ionicons name="partly-sunny" size={14} color="#FFFFFF" />
                    <Text variant="caption" style={styles.white}>
                      {Math.round(result.weather.temperature)}° {result.weather.description ?? ''}
                    </Text>
                  </View>
                )}
                {total > 0 && (
                  <View style={styles.pill}>
                    <Ionicons name="wallet" size={14} color="#FFFFFF" />
                    <Text variant="caption" style={styles.white}>
                      {t('city.perPerson', { amount: formatMoney(total, result.currency) })}
                    </Text>
                  </View>
                )}
              </View>
            </LinearGradient>
            {result.stops.map((s, i) => (
              <StopCard key={`${s.place_name}-${i}`} stop={s} index={i} last={i === result.stops.length - 1} currency={result.currency} />
            ))}
            {route && <Button title={t('city.openRoute')} variant="secondary" icon="map" onPress={() => Linking.openURL(route)} />}
            <Text variant="caption" color="textMuted" style={{ color: colors.textMuted }}>
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
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  heroPills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.22)' },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.88)' },
  stopRow: { flexDirection: 'row', gap: Spacing.md },
  rail: { alignItems: 'center', width: 34 },
  railDot: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  railLine: { flex: 1, width: 2, marginTop: 4, borderRadius: 1 },
  stopHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  placeLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
