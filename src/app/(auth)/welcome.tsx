import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '@/components/brand/logo-mark';
import { LanguagePicker } from '@/components/settings/language-picker';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Brand } from '@/config/brand';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Spacing } from '@/theme/tokens';

export default function WelcomeScreen() {
  const { t } = useTranslation();
  const continueAsGuest = useSessionStore((s) => s.continueAsGuest);

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('welcome.getStarted')}
            onPress={() => (isSupabaseConfigured() ? router.push('/sign-in') : continueAsGuest())}
          />
          {isSupabaseConfigured() && (
            <Button title={t('auth.guest')} variant="ghost" onPress={continueAsGuest} />
          )}
        </>
      }>
      <View style={styles.hero}>
        <LogoMark size={96} />
        <Text variant="display">{Brand.name}</Text>
        <Text variant="body" color="textSecondary" style={styles.center}>
          {t('app.tagline')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="title" style={styles.center}>
          {t('welcome.title')}
        </Text>
        <Text variant="body" color="textSecondary" style={styles.center}>
          {t('welcome.subtitle')}
        </Text>
      </View>

      <View style={styles.section}>
        <Text variant="caption" color="textMuted" style={styles.center}>
          {t('language.subtitle')}
        </Text>
        <LanguagePicker />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: Spacing.md, marginTop: Spacing.xxl },
  section: { gap: Spacing.md },
  center: { textAlign: 'center' },
});
