import { Text as RNText, type TextProps, type TextStyle } from 'react-native';

import i18n from '@/i18n';
import { Typography, type ThemeColors, type TypographyVariant } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = TextProps & {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
};

// Uygulama yazı tiplerinde Arapça ve Çince harf yok; bu dillerde sistem yazı tipi
// (aynı kalınlıkla) kullanılır.
const SYSTEM_FONT_LANGUAGES = new Set(['ar', 'zh']);

export function Text({ variant = 'body', color = 'text', style, ...rest }: Props) {
  const { colors } = useTheme();
  const base: TextStyle = Typography[variant];
  const font = SYSTEM_FONT_LANGUAGES.has(i18n.language) ? { fontFamily: undefined, letterSpacing: 0 } : null;
  // textAlign: 'auto' Arapça gibi sağdan sola dillerde metni otomatik sağa hizalar.
  return <RNText style={[base, font, { color: colors[color], textAlign: 'auto' }, style]} {...rest} />;
}
