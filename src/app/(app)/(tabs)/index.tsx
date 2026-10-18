import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, type Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DirIcon } from '@/components/ui/dir-icon';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { IconBadge } from '@/components/ui/icon-badge';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { useIsOnline } from '@/features/offline/use-online';
import { OpenNowSection } from '@/features/places/open-now-section';
import { useTrips } from '@/features/trips/queries';
import { TripCard } from '@/features/trips/trip-card';
import { isoDateDaysAgo, todayIsoDate } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Motion, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { NativeAdCard } from '@/features/ads/native-ad-card';
import { MyCitySection } from '@/features/city/my-city-section';

type IconName = ComponentProps<typeof Ionicons>['name'];

function greetingKey(hour: number) {
  if (hour >= 5 && hour < 12) return 'today.greetingMorning' as const;
  if (hour >= 12 && hour < 18) return 'today.greetingAfternoon' as const;
  if (hour >= 18 && hour < 23) return 'today.greetingEvening' as const;
  return 'today.greetingNight' as const;
}

const enter = (i: number) => FadeInDown.delay(i * Motion.stagger).springify().damping(Motion.enter.damping);

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const session = useSessionStore((s) => s.session);
  const online = useIsOnline();
  const { data: trips } = useTrips();
  const today = todayIsoDate();
  const nextTrip = trips?.find((trip) => !trip.end_date || trip.end_date >= today);
  // Son 30 günde biten ve henüz raporu oluşturulmamış seyahat.
  const monthAgo = isoDateDaysAgo(30);
  const endedTrip = trips?.find((trip) => trip.end_date && trip.end_date < today && trip.end_date >= monthAgo && trip.status !== 'completed');
  const dateLine = new Intl.DateTimeFormat(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());
  const initial = (session?.user.email ?? '?').slice(0, 1).toUpperCase();

  const quick: { icon: IconName; label: string; href: Href }[] = [
    { icon: 'people', label: t('today.quick.travelers'), href: '/social' },
    { icon: 'language', label: t('today.quick.translate'), href: '/translate' },
    { icon: 'medkit', label: t('today.quick.sos'), href: nextTrip ? { pathname: '/sos', params: { tripId: nextTrip.id } } : '/sos' },
  ];

  return (
    <Screen edges={['top']} tabBarSpace>
      <Animated.View entering={enter(0)} style={styles.header}>
        <View style={styles.headerText}>
          <Text variant="overline" color="textMuted">
            {dateLine}
          </Text>
          <Text variant="display">{t(greetingKey(new Date().getHours()))}</Text>
        </View>
        <Tap accessibilityRole="button" accessibilityLabel={t('tabs.profile')} onPress={() => router.navigate('/profile')} feedback="select">
          <LinearGradient colors={Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
            <Text variant="bodyStrong" style={styles.white}>
              {initial}
            </Text>
          </LinearGradient>
        </Tap>
      </Animated.View>

      <Animated.View entering={enter(1)}>
        {nextTrip ? (
          <TripCard trip={nextTrip} highlight />
        ) : (
          <EmptyState icon="airplane" title={t('today.noTripTitle')} description={t('today.noTripDescription')}>
            <Button title={t('today.uploadTicket')} icon="cloud-upload-outline" onPress={() => router.push('/ticket')} />
            <Button title={t('today.createManually')} variant="secondary" onPress={() => router.push('/trip-new')} />
          </EmptyState>
        )}
      </Animated.View>

      <Animated.View entering={enter(2)} style={styles.pills}>
        {quick.map((q) => (
          <Tap key={q.label} accessibilityRole="button" accessibilityLabel={q.label} onPress={() => router.push(q.href)} scaleTo={0.96} style={styles.flex}>
            <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={q.icon} size={18} color={colors.primary} />
              <Text variant="caption" numberOfLines={1} style={styles.pillText}>
                {q.label}
              </Text>
            </View>
          </Tap>
        ))}
      </Animated.View>

      <Animated.View entering={enter(3)}>
        <MyCitySection />
      </Animated.View>

      {endedTrip && (
        <Animated.View entering={enter(3)}>
          <Card variant="glow" onPress={() => router.push({ pathname: '/trip-report', params: { tripId: endedTrip.id } })} accessibilityLabel={t('report.endedTitle', { trip: endedTrip.title })}>
            <View style={styles.rowCenter}>
              <IconBadge icon="trophy" tone="gradient" />
              <View style={styles.flex}>
                <Text variant="bodyStrong">{t('report.endedTitle', { trip: endedTrip.title })}</Text>
                <Text variant="caption" color="textSecondary">
                  {t('report.ctaBody')}
                </Text>
              </View>
              <DirIcon name="chevron-forward" size={18} color={colors.textMuted} />
            </View>
          </Card>
        </Animated.View>
      )}

      {session && isSupabaseConfigured() && online && (
        <Animated.View entering={enter(4)}>
          <OpenNowSection />
        </Animated.View>
      )}

      <NativeAdCard />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xxs },
  avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)' },
  white: { color: '#FFFFFF' },
  section: { gap: Spacing.md },
  flex: { flex: 1 },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  pills: { flexDirection: 'row', gap: Spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.xs, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2 },
  pillText: { flexShrink: 1 },
});
