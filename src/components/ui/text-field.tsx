import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
  /** Alanın altında gösterilen yardımcı metin (ör. beklenen biçim). */
  hint?: string;
  /** Doluysa alan sarı çerçeveyle ve bu etiketle "kontrol et" olarak işaretlenir. */
  warning?: string | null;
};

export function TextField({ label, error, hint, warning, style, ...rest }: Props) {
  const { colors } = useTheme();
  const borderColor = error ? colors.danger : warning ? colors.warning : colors.border;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="caption" color="textSecondary" style={styles.label}>
          {label}
        </Text>
        {warning && !error && (
          <View style={styles.badge}>
            <Ionicons name="alert-circle" size={14} color={colors.warning} />
            <Text variant="caption" color="warning">
              {warning}
            </Text>
          </View>
        )}
      </View>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          Typography.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: warning || error ? 2 : 1,
            textAlign: 'auto',
          },
          style,
        ]}
        {...rest}
      />
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
});
