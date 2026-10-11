import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useIsOnline } from './use-online';

/** Bağlantı yokken ekranın üstünde ince bir şerit gösterir. */
export function OfflineBanner() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.banner, { backgroundColor: colors.text, paddingTop: insets.top + Spacing.xs }]}>
      <Ionicons name="cloud-offline-outline" size={16} color={colors.background} />
      <Text variant="caption" style={[styles.text, { color: colors.background }]}>
        {t('offline.banner')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xs },
  text: { flex: 1 },
});
