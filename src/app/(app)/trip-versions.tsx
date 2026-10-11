import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { usePlanVersionDays, usePlanVersions, useRestoreVersion, type PlanVersionRow } from '@/features/plan/replan';
import { formatDateRange, formatDayShort, formatLocalDateTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { diffPlans } from '../../../supabase/functions/_shared/replan.ts';

function VersionDiff({ version, activeId, tripId }: { version: PlanVersionRow; activeId: string; tripId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: active } = usePlanVersionDays(activeId);
  const { data: selected } = usePlanVersionDays(version.id);
  const restore = useRestoreVersion(tripId);

  if (!active || !selected) return <ActivityIndicator color={colors.primary} />;
  // "Bu sürüme dönersem ne değişir": kullanılan plandan bu sürüme farklar.
  const diff = diffPlans(active, selected);

  return (
    <View style={styles.diff}>
      <Text variant="caption" color="textSecondary">
        {t('versions.compare')}
      </Text>
      {diff.length === 0 ? (
        <Text variant="body" color="textMuted">
          {t('versions.noDiff')}
        </Text>
      ) : (
        diff.map((d) => (
          <View key={d.date} style={styles.diffDay}>
            <Text variant="bodyStrong">{formatDayShort(d.date)}</Text>
            {d.added.map((title) => (
              <View key={`+${title}`} style={styles.diffRow}>
                <Ionicons name="add-circle" size={16} color={colors.success} />
                <Text variant="body" style={styles.flex}>
                  {title}
                </Text>
              </View>
            ))}
            {d.removed.map((title) => (
              <View key={`-${title}`} style={styles.diffRow}>
                <Ionicons name="remove-circle" size={16} color={colors.danger} />
                <Text variant="body" color="textSecondary" style={[styles.flex, styles.strike]}>
                  {title}
                </Text>
              </View>
            ))}
          </View>
        ))
      )}
      <Button title={t('versions.restore')} variant="secondary" loading={restore.isPending} onPress={() => restore.mutate(version.id)} />
    </View>
  );
}

/** Plan geçmişi: her değişiklik bir sürümdür; farklar görülüp eski sürüme dönülebilir. */
export default function TripVersionsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { data: versions, isLoading } = usePlanVersions(tripId);
  const [open, setOpen] = useState<string | null>(null);
  const activeId = versions?.find((v) => v.is_active)?.id ?? null;

  return (
    <Screen>
      <ModalHeader title={t('versions.title')} subtitle={t('versions.subtitle')} />
      {isLoading && <ActivityIndicator color={colors.primary} />}
      {versions?.map((v) => {
        const expanded = open === v.id && !v.is_active;
        return (
          <View key={v.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: v.is_active ? colors.primary : colors.border }]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              disabled={v.is_active}
              onPress={() => setOpen(expanded ? null : v.id)}
              style={styles.header}>
              <View style={styles.flex}>
                <Text variant="bodyStrong">
                  {v.version}. {t(`versions.reason.${v.reason}`)}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatLocalDateTime(v.created_at, null)}
                  {v.trip_start_date ? ` · ${t('versions.dates', { dates: formatDateRange(v.trip_start_date, v.trip_end_date) })}` : ''}
                </Text>
                {(v.user_prompt || v.summary) && (
                  <Text variant="caption" color="textSecondary" numberOfLines={2}>
                    {v.reason === 'crisis' && v.user_prompt ? `“${v.user_prompt}”` : v.summary}
                  </Text>
                )}
              </View>
              {v.is_active ? (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text variant="caption" style={{ color: colors.onPrimary }}>
                    {t('versions.active')}
                  </Text>
                </View>
              ) : (
                <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
              )}
            </Pressable>
            {expanded && activeId && <VersionDiff version={v} activeId={activeId} tripId={tripId} />}
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xxs, borderRadius: Radius.pill },
  diff: { gap: Spacing.md },
  diffDay: { gap: Spacing.xs },
  diffRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  strike: { textDecorationLine: 'line-through' },
});
