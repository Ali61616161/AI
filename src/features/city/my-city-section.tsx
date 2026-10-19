import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Features } from '@/config/features';
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
import { useHomeCityLabel } from './use-home-city-label';

type Row = { key: 'evening' | 'getaway' | 'spin' | 'decide' | 'saved'; icon: ComponentProps<typeof Ionicons>['name']; href: Href };

const ALL_ROWS: (Row & { enabled: boolean })[] = [
  { key: 'evening', icon: 'moon-outline', href: '/evening', enabled: true },
  { key: 'getaway', icon: 'compass-outline', href: '/getaway', enabled: Features.getaway },
  { key: 'spin', icon: 'aperture-outline', href: '/spin', enabled: Features.spin },
  { key: 'decide', icon: 'dice-outline', href: '/decide', enabled: Features.decide },
  { key: 'saved', icon: 'bookmark-outline', href: '/saved', enabled: Features.savedPlaces },
];
const ROWS: Row[] = ALL_ROWS.filter((r) => r.enabled);

/** Ana ekranda ilk görünen satır sayısı; kalanlar "Daha fazla" ile açılır. */
const PRIMARY_ROWS = 2;

/** Ana ekrandaki Şehrim bölümü: tatil dışında da her hafta açılacak kısayollar. */
export function MyCitySection() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const homeCity = useSessionStore((s) => s.identity.homeCity);
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const { data: stats } = useCityStats();
  const [more, setMore] = useState(false);
  useHomeCityLabel();

  return (
    <View style={styles.section}>
      <SectionHeader overline={t('city.overline')} title={homeCity ?? t('city.addCityTitle')} action={homeCity && Features.savedPlaces ? t('city.passportShort') : undefined} onAction={() => router.push('/city-passport')} />
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
        {ROWS.filter((row) => signedIn || row.key === 'spin' || row.key === 'decide')
          .filter((row, i) => more || i < PRIMARY_ROWS)
          .map((row, i) => (
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
        {ROWS.length > PRIMARY_ROWS && (
        <Tap accessibilityRole="button" accessibilityLabel={more ? t('city.showLess') : t('city.showMore')} onPress={() => setMore((v) => !v)} feedback="select">
          <View style={[styles.listRow, styles.moreRow, { borderTopColor: colors.border }]}>
            <Text variant="caption" color="primary">
              {more ? t('city.showLess') : t('city.showMore')}
            </Text>
            <Ionicons name={more ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
          </View>
        </Tap>
        )}
      </Card>
      {more && signedIn && stats && stats.places > 0 && (
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
  moreRow: { justifyContent: 'center', borderTopWidth: StyleSheet.hairlineWidth * 2, paddingVertical: Spacing.sm },
  streak: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
});
