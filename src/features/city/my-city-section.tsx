import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Card } from '@/components/ui/card';
import { DirIcon } from '@/components/ui/dir-icon';
import { IconBadge } from '@/components/ui/icon-badge';
import { SectionHeader } from '@/components/ui/section-header';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useCityStats } from './api';

type Tile = { key: 'evening' | 'getaway' | 'spin' | 'saved'; icon: ComponentProps<typeof Ionicons>['name']; href: Href; colors: readonly [string, string, ...string[]] };

const TILES: Tile[] = [
  { key: 'evening', icon: 'sparkles', href: '/evening', colors: Gradients.sunset },
  { key: 'getaway', icon: 'compass', href: '/getaway', colors: Gradients.accent },
  { key: 'spin', icon: 'aperture', href: '/spin', colors: Gradients.primary },
  { key: 'saved', icon: 'bookmark', href: '/saved', colors: ['#3D8BFF', '#7C5CFF'] },
];

/** Ana ekrandaki Şehrim bölümü: tatil dışında da her hafta açılacak kısayollar. */
export function MyCitySection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const homeCity = useSessionStore((s) => s.identity.homeCity);
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const { data: stats } = useCityStats();

  return (
    <View style={styles.section}>
      <SectionHeader overline={t('city.overline')} title={homeCity ?? t('city.addCityTitle')} action={homeCity ? t('city.passportShort') : undefined} onAction={() => router.push('/city-passport')} />
      {!homeCity && (
        <Card variant="glow" onPress={() => router.push('/passport')} accessibilityLabel={t('city.addCityTitle')}>
          <View style={styles.row}>
            <IconBadge icon="location" tone="gradient" />
            <Text variant="body" color="textSecondary" style={styles.flex}>
              {t('city.addCityBody')}
            </Text>
            <DirIcon name="chevron-forward" size={18} color={colors.textMuted} />
          </View>
        </Card>
      )}
      <View style={styles.grid}>
        {TILES.filter((tile) => signedIn || tile.key === 'spin').map((tile) => (
          <Tap key={tile.key} accessibilityRole="button" accessibilityLabel={t(`city.tiles.${tile.key}.title`)} onPress={() => router.push(tile.href)} scaleTo={0.96} style={styles.tileWrap}>
            <LinearGradient colors={tile.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.tile}>
              <View pointerEvents="none" style={styles.ring} />
              <View style={styles.tileIcon}>
                <Ionicons name={tile.icon} size={22} color="#FFFFFF" />
              </View>
              <Text variant="bodyStrong" style={styles.white} numberOfLines={1}>
                {t(`city.tiles.${tile.key}.title`)}
              </Text>
              <Text variant="caption" style={styles.whiteSoft} numberOfLines={2}>
                {t(`city.tiles.${tile.key}.body`)}
              </Text>
            </LinearGradient>
          </Tap>
        ))}
      </View>
      {signedIn && stats && stats.places > 0 && (
        <Tap accessibilityRole="button" onPress={() => router.push('/city-passport')} feedback="select">
          <View style={[styles.streak, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="flame" size={18} color={colors.warning} />
            <Text variant="caption" style={styles.flex}>
              {t('city.streakLine', { weeks: stats.week_streak, places: stats.places })}
            </Text>
            <DirIcon name="chevron-forward" size={16} color={colors.textMuted} />
          </View>
        </Tap>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  tileWrap: { width: '47%', flexGrow: 1 },
  tile: { borderRadius: Radius.xl, padding: Spacing.lg, gap: 4, minHeight: 130, overflow: 'hidden' },
  ring: { position: 'absolute', right: -30, top: -30, width: 110, height: 110, borderRadius: 55, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  tileIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.22)', marginBottom: Spacing.xs },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.85)' },
  streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
});
