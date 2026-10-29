import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { formatTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { FlowStatus } from './live-flow';
import type { LiveStopRow } from './live-hero';

type Props = {
  stops: LiveStopRow[];
  statuses: FlowStatus[] | null;
  selectedId: string | null;
  /** Önceki duraktan yürüme/uzaklık metni (varsa). */
  hop: (index: number) => string | null;
  onSelect: (id: string) => void;
};

/** Günün sade dikey çizgisi: yapılanlar soluk ve işaretli, şu anki vurgulu; dokununca harita o durağa gider. */
export function LiveTimeline({ stops, statuses, selectedId, hop, onSelect }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {stops.map((item, index) => {
        const status = statuses?.[index];
        const finished = status === 'done' || status === 'skipped';
        const live = status === 'now' || status === 'here';
        const active = item.id === selectedId;
        const dot = finished ? colors.textMuted : live ? colors.success : status === 'enroute' || status === 'next' ? colors.primary : colors.surfaceMuted;
        return (
          <Tap key={item.id} accessibilityRole="button" accessibilityLabel={item.title} onPress={() => onSelect(item.id)} feedback="select">
            <View style={[styles.row, active && { backgroundColor: colors.surfaceMuted }]}>
              <View style={styles.rail}>
                <View style={[styles.dot, { backgroundColor: dot }]}>
                  {finished ? (
                    <Ionicons name={status === 'done' ? 'checkmark' : 'close'} size={12} color={colors.background} />
                  ) : (
                    <Text variant="caption" style={{ color: dot === colors.surfaceMuted ? colors.text : colors.onPrimary, fontWeight: '800', fontSize: 11, lineHeight: 14 }}>
                      {index + 1}
                    </Text>
                  )}
                </View>
              </View>
              <View style={[styles.flex, finished && styles.muted]}>
                <Text variant="bodyStrong" numberOfLines={1} style={status === 'skipped' ? styles.strike : undefined}>
                  {item.title}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {[item.starts_at ? formatTime(item.starts_at, item.timezone) : null, hop(index)].filter(Boolean).join(' · ')}
                </Text>
              </View>
              {status && status !== 'later' && status !== 'past' && !finished && (
                <Text variant="caption" style={{ color: live ? colors.success : colors.primary, fontWeight: '700' }}>
                  {t(`live.status.${status}`)}
                </Text>
              )}
            </View>
          </Tap>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden', paddingVertical: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  rail: { width: 22, alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center' },
  dot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
  muted: { opacity: 0.55 },
  strike: { textDecorationLine: 'line-through' },
});
