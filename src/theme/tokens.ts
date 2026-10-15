import { Brand } from '@/config/brand';

/**
 * Yola tasarım dili: koyu, derin gece mavisi zemin; üzerinde yarı saydam "cam"
 * yüzeyler; mercan → pembe ve turkuaz → mor geçişli parlak vurgular.
 * Açık tema aynı vurguları ferah bir zeminle kullanır.
 */
const palette = {
  ...Brand.colors,
  white: '#FFFFFF',
  void: '#04060C',
  deep: '#070B16',
  night: '#0C1222',
  ink: '#0E1324',
  snow: '#F4F6FB',
  mist: '#E7EAF3',
  slate: '#5B6478',
  pink: '#FF3D7F',
  violet: '#7C5CFF',
  cyan: '#2EE6C9',
  success: '#2FD47A',
  warning: '#FFB020',
  danger: '#FF4D5E',
  budgetLow: '#2FD47A',
  budgetMid: '#4D8DFF',
  budgetLux: '#B067FF',
} as const;

export const Colors = {
  light: {
    background: palette.snow,
    backgroundElevated: palette.white,
    surface: palette.white,
    surfaceMuted: '#EDEFF6',
    surfaceStrong: '#E3E7F1',
    border: 'rgba(14,19,36,0.08)',
    borderStrong: 'rgba(14,19,36,0.16)',
    text: palette.ink,
    textSecondary: 'rgba(14,19,36,0.68)',
    textMuted: 'rgba(14,19,36,0.42)',
    primary: '#F2552F',
    primarySoft: palette.coralSoft,
    onPrimary: palette.white,
    accent: '#14B8A0',
    violet: palette.violet,
    success: '#16A35A',
    warning: '#D98E00',
    danger: '#E5394A',
    budgetLow: '#16A35A',
    budgetMid: '#2F6FE0',
    budgetLux: '#8E46E8',
    overlay: 'rgba(8,12,24,0.45)',
  },
  dark: {
    background: palette.deep,
    backgroundElevated: palette.night,
    surface: 'rgba(255,255,255,0.045)',
    surfaceMuted: 'rgba(255,255,255,0.075)',
    surfaceStrong: 'rgba(255,255,255,0.12)',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.16)',
    text: '#F3F5FF',
    textSecondary: 'rgba(232,236,255,0.70)',
    textMuted: 'rgba(232,236,255,0.42)',
    primary: palette.coral,
    primarySoft: palette.coralSoft,
    onPrimary: palette.white,
    accent: palette.cyan,
    violet: '#9A82FF',
    success: palette.success,
    warning: palette.warning,
    danger: palette.danger,
    budgetLow: palette.budgetLow,
    budgetMid: palette.budgetMid,
    budgetLux: palette.budgetLux,
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeColors = { [K in keyof typeof Colors.light]: string };

/** Geçişler: düğmeler, vurgular ve arka plan ışıkları. */
export const Gradients = {
  primary: ['#FF7A45', '#FF3D7F'] as const,
  accent: ['#2EE6C9', '#7C5CFF'] as const,
  sunset: ['#FFB547', '#FF6B4A', '#FF3D7F'] as const,
  night: ['#1A2140', '#0C1222'] as const,
  danger: ['#FF6A5B', '#E5294A'] as const,
};

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
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/**
 * Yazı tipleri: başlıkta ve metinde sade "Manrope" (ikisi de
 * Latin ve Kiril). Arapça ve Çincede sistem yazı tipi kullanılır (Text bileşeni).
 */
export const Fonts = {
  display: 'Manrope_700Bold',
  displayBold: 'Manrope_800ExtraBold',
  regular: 'Manrope_500Medium',
  medium: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  heavy: 'Manrope_800ExtraBold',
} as const;

export const Typography = {
  hero: { fontFamily: Fonts.displayBold, fontSize: 38, lineHeight: 44, letterSpacing: -0.5, fontWeight: '700' },
  display: { fontFamily: Fonts.display, fontSize: 30, lineHeight: 36, letterSpacing: -0.3, fontWeight: '600' },
  title: { fontFamily: Fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.1, fontWeight: '600' },
  heading: { fontFamily: Fonts.display, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, fontWeight: '600' },
  subtitle: { fontFamily: Fonts.heavy, fontSize: 18, lineHeight: 24, letterSpacing: -0.2, fontWeight: '800' },
  body: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 23, fontWeight: '500' },
  bodyStrong: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22, fontWeight: '700' },
  caption: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 18, fontWeight: '600' },
  overline: { fontFamily: Fonts.heavy, fontSize: 11, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase', fontWeight: '800' },
  stat: { fontFamily: Fonts.displayBold, fontSize: 28, lineHeight: 32, letterSpacing: -0.4, fontWeight: '700' },
} as const;

export type TypographyVariant = keyof typeof Typography;

/** Yay (spring) ayarları: dokunuşta hafif küçülme ve ekrana giriş animasyonları. */
export const Motion = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  enter: { damping: 20, stiffness: 180 },
  stagger: 55,
} as const;
