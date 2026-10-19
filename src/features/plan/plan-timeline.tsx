import { openPlaceCard } from '@/features/places/place-card-api';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { openBookingLink, openInMaps, type DayForecast } from '@/features/places/api';
import { PlaceMeta } from '@/features/places/place-row';
import { WeatherBadge } from '@/features/places/weather-badge';
import type { PlanDayRow, PlanItemRow } from '@/features/trips/queries';
import { formatDayShort, formatMoney, formatTime } from '@/lib/format';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

const KIND_ICONS: Record<PlanItemRow['kind'], IconName> = {
  activity: 'compass-outline',
  meal: 'restaurant-outline',
  transport: 'airplane-outline',
  accommodation: 'bed-outline',
  free_time: 'cafe-outline',
  reservation: 'ticket-outline',
};

export function DaySelector({
  days,
  selected,
  onSelect,
}: {
  days: PlanDayRow[];
  selected: number;
  onSelect: (index: number) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days} accessibilityRole="tablist">
      {days.map((day, index) => {
        const active = index === selected;
        return (
          <Tap key={day.id} accessibilityRole="tab" accessibilityState={{ selected: active }} onPress={() => onSelect(index)} feedback="select" scaleTo={0.94}>
            {active ? (
              <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.day, styles.dayActive]}>
                <Text variant="overline" style={styles.onPrimarySoft}>
                  {formatDayShort(day.date)}
                </Text>
                <Text variant="subtitle" style={styles.onPrimary}>
                  {t('plan.dayLabel', { n: index + 1 })}
                </Text>
              </LinearGradient>
            ) : (
              <View style={[styles.day, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text variant="overline" color="textMuted">
                  {formatDayShort(day.date)}
                </Text>
                <Text variant="subtitle">{t('plan.dayLabel', { n: index + 1 })}</Text>
              </View>
            )}
          </Tap>
        );
      })}
    </ScrollView>
  );
}

function Badge({ icon, label, tone = 'muted' }: { icon?: IconName; label: string; tone?: 'muted' | 'accent' | 'primary' }) {
  const { colors } = useTheme();
  const color = tone === 'accent' ? colors.accent : tone === 'primary' ? colors.primary : colors.textSecondary;
  return (
    <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
      {icon && <Ionicons name={icon} size={12} color={color} />}
      <Text variant="caption" style={[styles.badgeText, { color }]}>
        {label}
      </Text>
    </View>
  );
}

function TimelineItem({ item, last, city, from, tripId }: { item: PlanItemRow; last: boolean; city: string | null; from: PlanItemRow | null; tripId?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const time = item.starts_at ? formatTime(item.starts_at, item.timezone) : '';
  const endTime = item.ends_at ? formatTime(item.ends_at, item.timezone) : null;
  const closed = item.place_status === 'CLOSED_PERMANENTLY' || item.place_status === 'CLOSED_TEMPORARILY';
  const mappable = !item.is_locked && item.kind !== 'transport' && Boolean(item.place_name || item.lat !== null);
  const routable = isRoutable(item);
  const title =
    item.category === 'check_in' ? `${t('plan.checkIn')} · ${item.title}` : item.category === 'check_out' ? `${t('plan.checkOut')} · ${item.title}` : item.title;

  return (
    <View style={styles.item}>
      <View style={styles.timeCol}>
        <Text variant="bodyStrong" style={styles.time}>
          {time}
        </Text>
        {endTime && (
          <Text variant="caption" color="textMuted" style={styles.time}>
            {endTime}
          </Text>
        )}
      </View>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: item.is_locked ? colors.primary : colors.surface, borderColor: colors.primary }]}>
          <Ionicons name={item.is_locked ? 'lock-closed' : KIND_ICONS[item.kind]} size={14} color={item.is_locked ? colors.onPrimary : colors.primary} />
        </View>
        {!last && <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: item.is_locked ? colors.primary : colors.border }]}>
        <Text variant="bodyStrong">{title}</Text>
        {item.place_name && item.place_name !== item.title && (
          <Text variant="caption" color="textSecondary">
            {item.place_name}
          </Text>
        )}
        {item.rating !== null && <PlaceMeta rating={item.rating} ratingCount={item.rating_count} priceLevel={null} distanceM={null} />}
        {closed && (
          <View style={styles.warning}>
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text variant="caption" color="danger" style={styles.flex}>
              {item.place_status === 'CLOSED_PERMANENTLY' ? t('place.closedPermanently') : t('place.closedTemporarily')}
            </Text>
          </View>
        )}
        {item.description && (
          <Text variant="body" color="textSecondary" numberOfLines={3}>
            {item.description}
          </Text>
        )}
        <View style={styles.badges}>
          {item.is_locked && <Badge icon="lock-closed" label={t('plan.locked')} tone="primary" />}
          {!item.is_locked && item.priority >= 5 && <Badge icon="star" label={t('plan.highlight')} tone="primary" />}
          {item.estimated_cost !== null && item.cost_currency && (
            <Badge
              icon="wallet-outline"
              label={item.estimated_cost === 0 ? t('plan.free') : t('plan.estimatedPrice', { amount: formatMoney(item.estimated_cost, item.cost_currency) })}
              tone={item.estimated_cost === 0 ? 'accent' : 'muted'}
            />
          )}
          {item.is_indoor !== null && !item.is_locked && (
            <Badge icon={item.is_indoor ? 'home-outline' : 'sunny-outline'} label={item.is_indoor ? t('plan.indoor') : t('plan.outdoor')} />
          )}
        </View>
        {(mappable || routable || item.booking_url) && (
          <View style={styles.actions}>
            {item.google_place_id && (
              <Chip
                icon="images-outline"
                label={t('place.details')}
                onPress={() => openPlaceCard({ id: item.google_place_id!, name: item.place_name ?? item.title, address: item.address, lat: item.lat, lng: item.lng, mapsUrl: item.maps_url })}
              />
            )}
            {mappable && (
              <Chip
                icon="navigate-outline"
                label={t('map.openInMaps')}
                onPress={() =>
                  openInMaps({
                    name: [item.place_name ?? item.title, item.google_place_id ? null : city].filter(Boolean).join(', '),
                    mapsUrl: item.maps_url,
                    placeId: item.google_place_id,
                    lat: item.lat,
                    lng: item.lng,
                  })
                }
              />
            )}
            {routable && <Chip icon="git-branch-outline" label={t('route.howToGet')} onPress={() => openRoute(item, from, city, tripId)} />}
            {item.booking_url && <Chip icon="ticket-outline" label={t('place.buyTicket')} onPress={() => openBookingLink(item.booking_url!)} />}
          </View>
        )}
      </View>
    </View>
  );
}

/** Yol tarifi verilebilecek durak: ulaşım kalemi değil ve konumu ya da adı belli. */
const isRoutable = (i: PlanItemRow) => i.kind !== 'transport' && Boolean(i.lat !== null || i.place_name);

const placeLabel = (i: PlanItemRow, city: string | null) => [i.place_name ?? i.title, i.lat === null ? city : null].filter(Boolean).join(', ');

/** "Nasıl giderim?": bir önceki duraktan (yoksa kullanıcının konumundan) bu durağa. */
export function openRoute(item: PlanItemRow, from: PlanItemRow | null, city: string | null, tripId?: string) {
  const coords = (i: PlanItemRow, prefix: 'to' | 'from') => (i.lat !== null && i.lng !== null ? { [`${prefix}Lat`]: String(i.lat), [`${prefix}Lng`]: String(i.lng) } : {});
  router.push({
    pathname: '/route',
    params: {
      ...(tripId ? { tripId } : {}),
      ...coords(item, 'to'),
      toName: placeLabel(item, city),
      ...(from && from.lat !== null ? { ...coords(from, 'from'), fromName: placeLabel(from, city) } : {}),
      ...(from?.ends_at ? { departAt: from.ends_at } : {}),
    },
  });
}

export function DayTimeline({ day, weather, tripId }: { day: PlanDayRow; weather?: DayForecast | null; tripId?: string }) {
  const { t } = useTranslation();
  return (
    <View style={styles.timeline}>
      {(day.title || day.city) && (
        <View style={styles.dayHeader}>
          {day.title && <Text variant="subtitle">{day.title}</Text>}
          {day.city && (
            <Text variant="caption" color="textSecondary">
              {day.city}
            </Text>
          )}
        </View>
      )}
      {weather && <WeatherBadge forecast={weather} />}
      {day.notes && (
        <Text variant="body" color="textSecondary">
          {day.notes}
        </Text>
      )}
      {day.plan_items.length === 0 ? (
        <Text variant="body" color="textMuted">
          {t('plan.emptyDay')}
        </Text>
      ) : (
        day.plan_items.map((item, index) => (
          <TimelineItem
            key={item.id}
            item={item}
            city={day.city}
            last={index === day.plan_items.length - 1}
            from={day.plan_items.slice(0, index).findLast(isRoutable) ?? null}
            tripId={tripId}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  day: { minWidth: 86, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, gap: 2 },
  dayActive: { borderColor: 'transparent' },
  onPrimary: { color: '#FFFFFF' },
  onPrimarySoft: { color: 'rgba(255,255,255,0.8)' },
  timeline: { gap: Spacing.md },
  dayHeader: { gap: Spacing.xxs },
  item: { flexDirection: 'row', gap: Spacing.sm },
  timeCol: { width: 52, paddingTop: Spacing.md },
  time: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  rail: { width: 28, alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: Radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.md },
  line: { flex: 1, width: 2, marginTop: Spacing.xs },
  card: { flex: 1, gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1, marginBottom: Spacing.sm },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xxs },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs, paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: Radius.pill },
  badgeText: { fontSize: 12, lineHeight: 16 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginTop: Spacing.xs },
  warning: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  flex: { flex: 1 },
});
