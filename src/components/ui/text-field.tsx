import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Props = TextInputProps & {
  label: string;
  error?: string | null;
};

export function TextField({ label, error, style, ...rest }: Props) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        style={[
          Typography.body,
          styles.input,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
            textAlign: 'auto',
          },
          style,
        ]}
        {...rest}
      />
      {error && (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  input: {
    minHeight: 52,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
});
