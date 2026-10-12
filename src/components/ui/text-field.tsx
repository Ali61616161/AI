import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
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

export function TextField({ label, error, hint, warning, style, onFocus, onBlur, ...rest }: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : warning ? colors.warning : focused ? colors.primary : colors.border;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text variant="overline" color={focused ? 'primary' : 'textMuted'} style={styles.label}>
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
        selectionColor={colors.primary}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={[
          Typography.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor,
            borderWidth: focused || warning || error ? 1.5 : StyleSheet.hairlineWidth * 2,
            shadowColor: colors.primary,
            shadowOpacity: focused ? 0.25 : 0,
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
  wrap: { gap: Spacing.sm },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  label: { flex: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xxs },
  input: {
    minHeight: 54,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
  },
});
