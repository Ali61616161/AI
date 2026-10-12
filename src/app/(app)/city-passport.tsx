import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { BADGES, useCityStats, useVisits } from '@/features/city/api';
import { formatDayShort } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Motion, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Şehir pasaportu: keşfedilen yerler, haftalık seri ve rozetler. */
export default function CityPassportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const homeCity = useSessionStore((s) => s.identity.homeCity);
  const { data: stats } = useCityStats();
  const { data: visits = [] } = useVisits();
  const s = stats ?? { places: 0, visits: 0, categories: 0, this_month: 0, week_streak: 0 };

  const tiles = [
    { key: 'places', value: s.places, icon: 'location' },
    { key: 'streak', value: s.week_streak, icon: 'flame' },
    { key: 'month', value: s.this_month, icon: 'calendar' },
    { key: 'categories', value: s.categories, icon: 'color-palette' },
  ] as const;

  return (
    <Screen>
      <ModalHeader title={t('city.passportTitle')} subtitle={homeCity ? t('city.inCity', { city: homeCity }) : t('city.passportSubtitle')} />

      <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroTop}>
          <Ionicons name="ribbon" size={28} color="#FFFFFF" />
          <Text variant="overline" style={styles.whiteSoft}>
            {t('city.passportHero')}
          </Text>
        </View>
        <View style={styles.grid}>
          {tiles.map((tile, i) => (
            <Animated.View key={tile.key} entering={FadeInDown.delay(i * Motion.stagger)} style={styles.tile}>
              <Ionicons name={tile.icon} size={16} color="rgba(255,255,255,0.9)" />
              <Text variant="stat" style={styles.white}>
                {tile.value}
              </Text>
              <Text variant="caption" style={styles.whiteSoft}>
                {t(`city.stats.${tile.key}`)}
              </Text>
            </Animated.View>
          ))}
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <SectionHeader title={t('city.badgesTitle')} />
        <View style={styles.badges}>
          {BADGES.map((b) => {
            const on = b.reached(s);
            return (
              <View key={b.key} style={[styles.badge, { backgroundColor: colors.surface, borderColor: on ? colors.primary : colors.border, opacity: on ? 1 : 0.55 }]}>
                {on ? (
                  <LinearGradient colors={Gradients.primary} style={styles.badgeIcon}>
                    <Ionicons name={b.icon} size={20} color="#FFFFFF" />
                  </LinearGradient>
                ) : (
                  <View style={[styles.badgeIcon, { backgroundColor: colors.surfaceMuted }]}>
                    <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                  </View>
                )}
                <Text variant="caption" style={styles.center} numberOfLines={2}>
                  {t(`city.badges.${b.key}`)}
                </Text>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('city.recentTitle')} />
        {visits.length === 0 ? (
          <EmptyState icon="footsteps-outline" title={t('city.noVisitsTitle')} description={t('city.noVisitsBody')}>
            <Button title={t('city.eveningTitle')} icon="sparkles" onPress={() => router.push('/evening')} />
          </EmptyState>
        ) : (
          <Card padding={Spacing.xs}>
            {visits.slice(0, 30).map((v) => (
              <View key={v.id} style={styles.row}>
                <Ionicons name="checkmark-circle" size={18} color={colors.success} />
                <Text variant="body" style={styles.flex} numberOfLines={1}>
                  {v.name}
                </Text>
                <Text variant="caption" color="textMuted">
                  {formatDayShort(v.visited_on)}
                </Text>
              </View>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.md },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.lg },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tile: { width: '46%', flexGrow: 1, gap: 2, padding: Spacing.md, borderRadius: Radius.lg, backgroundColor: 'rgba(0,0,0,0.18)' },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.85)' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: { width: '30%', flexGrow: 1, alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  badgeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
});
