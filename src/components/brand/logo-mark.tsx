import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';

import { Brand } from '@/config/brand';

type Props = {
  size?: number;
  /** false ise arka plansız, sadece işaret çizilir (ör. koyu yüzeyler üzerinde). */
  withBackground?: boolean;
  /** İşaretin rengi (arka plansızken mercan, arka planlıyken beyaz kullanılır). */
  color?: string;
};

// Şeffaf arka planlı Yola işareti (kuş biçimli "Y"). Uygulama ikonuyla aynı çizim.
const MARK = require('../../../assets/images/splash-icon.png');

/** Yola logosu. tintColor ile istenen renge boyanır; çizim şeffaf PNG'den gelir. */
export function LogoMark({ size = 64, withBackground = true, color = '#FFFFFF' }: Props) {
  if (!withBackground) {
    return <Image source={MARK} style={{ width: size, height: size, tintColor: color }} resizeMode="contain" accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={{ width: size, height: size }}>
      <LinearGradient
        colors={[Brand.colors.midnight, Brand.colors.midnight]}
        style={[StyleSheet.absoluteFill, { borderRadius: size * 0.24 }]}
      />
      <Image
        source={MARK}
        style={{ width: size, height: size, tintColor: Brand.colors.coral, transform: [{ scale: 0.68 }] }}
        resizeMode="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}
