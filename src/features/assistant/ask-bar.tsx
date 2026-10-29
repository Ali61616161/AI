import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** "Yola'ya sor…" çubuğu: dokununca asistan (seçilen seyahatle) açılır. Yapay zekâ artık ayrı bir sekme değil, bağlam içinde. */
export function AskYolaBar({ tripId }: { tripId?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <Tap accessibilityRole="button" accessibilityLabel={t('assistant.askBar')} onPress={() => router.push({ pathname: '/assistant', params: tripId ? { tripId } : {} })} feedback="select">
      <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="sparkles" size={18} color={colors.primary} />
        <Text variant="body" color="textMuted" numberOfLines={1} style={styles.text}>
          {t('assistant.askBar')}
        </Text>
        <Ionicons name="arrow-up-circle" size={28} color={colors.primary} />
      </View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, minHeight: 50, borderRadius: Radius.pill, borderWidth: 1, paddingHorizontal: Spacing.md },
  text: { flex: 1 },
});
