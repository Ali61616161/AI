import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { Brand } from '@/config/brand';

type Props = {
  size?: number;
  /** false ise arka plansız, sadece "y" işareti çizilir (ör. koyu yüzeyler üzerinde). */
  withBackground?: boolean;
  color?: string;
};

/**
 * Yola logosu: ikiye ayrılan bir yol gibi çizilmiş küçük "y" harfi.
 * Kuyruğu bir rota çizgisi gibi kıvrılıp varış noktasında bitiyor.
 * assets/brand/logo-mark.svg ile aynı geometriyi kullanır.
 */
export function LogoMark({ size = 64, withBackground = true, color = '#FFFFFF' }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {withBackground && (
        <>
          <Defs>
            <LinearGradient id="yolaBg" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={Brand.colors.coralSoft} />
              <Stop offset="1" stopColor={Brand.colors.coral} />
            </LinearGradient>
          </Defs>
          <Rect width="100" height="100" rx="24" fill="url(#yolaBg)" />
        </>
      )}
      <Path
        d="M33 24 L54.5 51 M73 24 L47 62 Q42 69 37 73"
        stroke={color}
        strokeWidth={9}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="27" cy="80" r="6" fill={color} />
    </Svg>
  );
}
