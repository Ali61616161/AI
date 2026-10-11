import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { ScrollView, StyleSheet, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import type { PlanDayRow, PlanItemRow } from '@/features/trips/queries';
import { formatDayShort, formatMoney, formatTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
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
          <Pressable
            key={day.id}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onSelect(index)}
            style={[
              styles.day,
              { backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.border },
            ]}>
            <Text variant="bodyStrong" style={{ color: active ? colors.onPrimary : colors.text }}>
              {t('plan.dayLabel', { n: index + 1 })}
            </Text>
            <Text variant="caption" style={{ color: active ? colors.onPrimary : colors.textSecondary }}>
              {formatDayShort(day.date)}
            </Text>
          </Pressable>
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

function TimelineItem({ item, last }: { item: PlanItemRow; last: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const time = item.starts_at ? formatTime(item.starts_at, item.timezone) : '';
  const endTime = item.ends_at ? formatTime(item.ends_at, item.timezone) : null;
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
              label={item.estimated_cost === 0 ? t('plan.free') : `~${formatMoney(item.estimated_cost, item.cost_currency)}`}
              tone={item.estimated_cost === 0 ? 'accent' : 'muted'}
            />
          )}
          {item.is_indoor !== null && !item.is_locked && (
            <Badge icon={item.is_indoor ? 'home-outline' : 'sunny-outline'} label={item.is_indoor ? t('plan.indoor') : t('plan.outdoor')} />
          )}
        </View>
      </View>
    </View>
  );
}

export function DayTimeline({ day }: { day: PlanDayRow }) {
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
        day.plan_items.map((item, index) => <TimelineItem key={item.id} item={item} last={index === day.plan_items.length - 1} />)
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  days: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  day: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: Radius.lg, borderWidth: 1, alignItems: 'center' },
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
});
