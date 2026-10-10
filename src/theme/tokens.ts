import { Brand } from '@/config/brand';

const palette = {
  ...Brand.colors,
  white: '#FFFFFF',
  ink: '#111827',
  slate50: '#F7F8FA',
  slate100: '#EEF0F4',
  slate200: '#DDE1E8',
  slate400: '#8A93A6',
  slate600: '#4B5468',
  night800: '#141C2E',
  night700: '#1C2538',
  night600: '#2A344A',
  success: '#22C55E',
  warning: '#F5B400',
  danger: '#EF4444',
  budgetLow: '#22C55E',
  budgetMid: '#3B82F6',
  budgetLux: '#A855F7',
} as const;

export const Colors = {
  light: {
    background: palette.slate50,
    surface: palette.white,
    surfaceMuted: palette.slate100,
    border: palette.slate200,
    text: palette.ink,
    textSecondary: palette.slate600,
    textMuted: palette.slate400,
    primary: palette.coral,
    primarySoft: palette.coralSoft,
    onPrimary: palette.white,
    accent: palette.aqua,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    budgetLow: palette.budgetLow,
    budgetMid: palette.budgetMid,
    budgetLux: palette.budgetLux,
  },
  dark: {
    background: palette.midnight,
    surface: palette.night800,
    surfaceMuted: palette.night700,
    border: palette.night600,
    text: palette.white,
    textSecondary: palette.slate200,
    textMuted: palette.slate400,
    primary: palette.coral,
    primarySoft: palette.coralSoft,
    onPrimary: palette.white,
    accent: palette.aqua,
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    budgetLow: palette.budgetLow,
    budgetMid: palette.budgetMid,
    budgetLux: palette.budgetLux,
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

export const Spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  pill: 999,
} as const;

/**
 * Sistem yazı tipleri kullanılıyor: iOS'ta SF Pro, Android'de Roboto. İkisi de
 * Kiril, Arapça ve Çince karakterleri kendi yedek yazı tipleriyle gösterir.
 */
export const Typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  subtitle: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
} as const;

export type TypographyVariant = keyof typeof Typography;
