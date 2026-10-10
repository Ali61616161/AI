import { Text as RNText, type TextProps } from 'react-native';

import { Typography, type ThemeColors, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
};

export function Text({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const { colors } = useTheme();
  // textAlign: 'auto' Arapça gibi sağdan sola dillerde metni otomatik sağa hizalar.
  return (
    <RNText style={[Typography[variant], { color: colors[color], textAlign: 'auto' }, style]} {...rest} />
  );
}
