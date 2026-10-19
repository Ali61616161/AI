import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';

import { OrbitHero } from '@/components/brand/orbit-hero';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Brand } from '@/config/brand';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const PILLS: { icon: ComponentProps<typeof Ionicons>['name']; key: 'pillRoute' | 'pillTranslate' | 'pillOffline' }[] = [
  { icon: 'sparkles', key: 'pillRoute' },
  { icon: 'language', key: 'pillTranslate' },
  { icon: 'cloud-offline', key: 'pillOffline' },
];

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const introSeen = useSessionStore((s) => s.introSeen);

  // İlk açılışta önce tanıtım slaytları gösterilir.
  if (!introSeen) return <Redirect href="/intro" />;

  return (
    <Screen
      footer={
        <>
          <Button title={t('welcome.getStarted')} icon="arrow-forward" onPress={() => router.push('/sign-in')} />
          <Text variant="caption" color="textMuted" style={styles.legal}>
            {t('consent.guestNote')}{' '}
            <Text variant="caption" color="textSecondary" style={styles.link} onPress={() => router.push({ pathname: '/legal', params: { doc: 'terms' } })}>
              {t('legal.terms')}
            </Text>
          </Text>
        </>
      }>
      <Animated.View entering={FadeInDown.duration(700)} style={styles.hero}>
        <OrbitHero size={260} />
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(120).duration(600)} style={styles.section}>
        <Text variant="overline" color="primary">
          {Brand.name} · {t('app.tagline')}
        </Text>
        <Text variant="hero">{t('welcome.title')}</Text>
        <Text variant="body" color="textSecondary">
          {t('welcome.subtitle')}
        </Text>
        <View style={styles.pills}>
          {PILLS.map((p) => (
            <View key={p.key} style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={p.icon} size={14} color={colors.accent} />
              <Text variant="caption">{t(`welcome.${p.key}`)}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginTop: Spacing.sm },
  legal: { textAlign: 'center' },
  link: { textDecorationLine: 'underline' },
  section: { gap: Spacing.md },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, paddingVertical: 7, borderRadius: Radius.pill, borderWidth: StyleSheet.hairlineWidth * 2 },
});
