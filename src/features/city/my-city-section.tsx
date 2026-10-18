import Ionicons from '@expo/vector-icons/Ionicons';
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
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useCityStats } from './api';

type Row = { key: 'evening' | 'getaway' | 'spin' | 'decide' | 'saved'; icon: ComponentProps<typeof Ionicons>['name']; href: Href };

const ROWS: Row[] = [
  { key: 'evening', icon: 'moon-outline', href: '/evening' },
  { key: 'getaway', icon: 'compass-outline', href: '/getaway' },
  { key: 'spin', icon: 'aperture-outline', href: '/spin' },
  { key: 'decide', icon: 'dice-outline', href: '/decide' },
  { key: 'saved', icon: 'bookmark-outline', href: '/saved' },
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
      <Card padding={0}>
        {ROWS.filter((row) => signedIn || row.key === 'spin' || row.key === 'decide').map((row, i) => (
          <Tap
            key={row.key}
            accessibilityRole="button"
            accessibilityLabel={row.key === 'decide' ? t('today.quick.decideTitle') : t(`city.tiles.${row.key}.title`)}
            onPress={() => router.push(row.href)}
            feedback="select">
            <View style={[styles.listRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: colors.border }]}>
              <IconBadge icon={row.icon} size={38} />
              <View style={styles.flex}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {row.key === 'decide' ? t('today.quick.decideTitle') : t(`city.tiles.${row.key}.title`)}
                </Text>
                <Text variant="caption" color="textMuted" numberOfLines={1}>
                  {row.key === 'decide' ? t('today.quick.decideBody') : t(`city.tiles.${row.key}.body`)}
                </Text>
              </View>
              <DirIcon name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </Tap>
        ))}
      </Card>
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
  listRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  flex: { flex: 1 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
});
