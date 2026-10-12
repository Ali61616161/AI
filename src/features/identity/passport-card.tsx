import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { flag } from '@/features/tools/emergency-numbers';
import { Radius, Spacing } from '@/theme/tokens';

import type { PassportPower } from '../../../supabase/functions/_shared/visa-access.ts';

const BAR = [
  { key: 'visaFree', color: '#2EE6C9' },
  { key: 'onArrival', color: '#7CFFB2' },
  { key: 'eta', color: '#FFB547' },
  { key: 'evisa', color: '#FF9A62' },
  { key: 'required', color: 'rgba(255,255,255,0.22)' },
] as const;

/** Pasaport gücü kartı: kolay giriş sayısı, dünya sırası ve dağılım çubuğu. */
export function PassportCard({ passports, power, onPress }: { passports: string[]; power: PassportPower; onPress?: () => void }) {
  const { t } = useTranslation();
  const total = BAR.reduce((n, b) => n + power[b.key], 0) || 1;
  const body = (
    <LinearGradient colors={['#18245A', '#5B3FD9', '#B23A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
      <View style={styles.top}>
        <Text style={styles.flags}>{passports.map(flag).join(' ')}</Text>
        {power.rank !== null && (
          <View style={styles.rank}>
            <Text variant="caption" style={styles.white}>
              {t('passport.rank', { rank: power.rank })}
            </Text>
          </View>
        )}
      </View>
      <Animated.View entering={FadeIn.duration(500)} key={power.score} style={styles.scoreRow}>
        <Text variant="hero" style={styles.white}>
          {power.score}
        </Text>
        <Text variant="body" style={styles.soft}>
          {t('passport.easyCount')}
        </Text>
      </Animated.View>
      <View style={styles.bar} accessibilityLabel={t('passport.breakdownA11y', { free: power.visaFree, arrival: power.onArrival, eta: power.eta, evisa: power.evisa, required: power.required })}>
        {BAR.map((b) => (power[b.key] ? <View key={b.key} style={{ flex: power[b.key] / total, backgroundColor: b.color }} /> : null))}
      </View>
      <View style={styles.legend}>
        <Text variant="caption" style={styles.soft}>
          {t('passport.legend', { free: power.visaFree, arrival: power.onArrival + power.eta, evisa: power.evisa })}
        </Text>
        {power.unlocked > 0 && (
          <View style={styles.unlocked}>
            <Text variant="caption" style={styles.white}>
              {t('passport.unlocked', { count: power.unlocked })}
            </Text>
          </View>
        )}
      </View>
    </LinearGradient>
  );
  if (!onPress) return body;
  return (
    <Tap accessibilityRole="button" onPress={onPress} scaleTo={0.98}>
      {body}
    </Tap>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  flags: { fontSize: 26 },
  rank: { paddingHorizontal: Spacing.md, paddingVertical: 5, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm, flexWrap: 'wrap' },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.82)', marginBottom: 6, flexShrink: 1 },
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.12)' },
  legend: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm, flexWrap: 'wrap' },
  unlocked: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill, backgroundColor: 'rgba(46,230,201,0.25)' },
});
