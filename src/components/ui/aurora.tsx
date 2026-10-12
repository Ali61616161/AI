import { StyleSheet, View } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';

type Glow = { cx: string; cy: string; rx: string; ry: string; color: string; opacity: number };

const DARK: Glow[] = [
  { cx: '8%', cy: '-2%', rx: '75%', ry: '30%', color: '#FF5A3D', opacity: 0.3 },
  { cx: '100%', cy: '6%', rx: '70%', ry: '28%', color: '#7C5CFF', opacity: 0.26 },
  { cx: '85%', cy: '100%', rx: '80%', ry: '30%', color: '#1BC7B0', opacity: 0.08 },
];
const LIGHT: Glow[] = [
  { cx: '8%', cy: '-4%', rx: '75%', ry: '28%', color: '#FF8A5C', opacity: 0.22 },
  { cx: '100%', cy: '4%', rx: '70%', ry: '26%', color: '#9A82FF', opacity: 0.16 },
];

/** Ekranın arkasındaki yumuşak renk ışıkları (aurora). Dokunuşları engellemez. */
export function Aurora({ variant = 'default' }: { variant?: 'default' | 'subtle' }) {
  const { colors, isDark } = useTheme();
  const glows = isDark ? DARK : LIGHT;
  const scale = variant === 'subtle' ? 0.55 : 1;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          {glows.map((g, i) => (
            <RadialGradient key={i} id={`glow${i}`} cx={g.cx} cy={g.cy} rx={g.rx} ry={g.ry} fx={g.cx} fy={g.cy} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity * scale} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {glows.map((_, i) => (
          <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#glow${i})`} />
        ))}
      </Svg>
    </View>
  );
}
