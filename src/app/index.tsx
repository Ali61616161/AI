import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo-mark';
import { LanguagePicker } from '@/components/settings/language-picker';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Brand } from '@/config/brand';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/**
 * Geçici karşılama ekranı. Marka, tema ve dil altyapısını göstermek için var;
 * 3. adımda alt menü kurulunca onboarding akışının ilk ekranına dönüşecek.
 */
export default function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
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

        <Button title={t('welcome.getStarted')} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.xl,
    gap: Spacing.xxl,
  },
  hero: { alignItems: 'center', gap: Spacing.md },
  section: { gap: Spacing.md },
  center: { textAlign: 'center' },
});
