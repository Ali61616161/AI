import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { goBack } from '@/lib/go-back';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';
import { Text } from './text';

export function ModalHeader({ title, subtitle, overline }: { title: string; subtitle?: string; overline?: string }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <View style={styles.top}>
        <View style={styles.titles}>
          {overline && (
            <Text variant="overline" color="primary">
              {overline}
            </Text>
          )}
          <Text variant="display">{title}</Text>
        </View>
        <Tap
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={goBack}
          hitSlop={12}
          feedback="select"
          style={[styles.close, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <Ionicons name="close" size={20} color={colors.text} />
        </Tap>
      </View>
      {subtitle && (
        <Text variant="body" color="textSecondary">
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.sm },
  top: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  titles: { flex: 1, gap: Spacing.xs },
  close: { width: 40, height: 40, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth * 2, marginTop: 2 },
});
