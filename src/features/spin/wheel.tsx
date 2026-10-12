import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';
import Svg, { Circle, Defs, G, Path, RadialGradient, Stop, Text as SvgText } from 'react-native-svg';

export const WHEEL_COLORS = ['#FF7A45', '#7C5CFF', '#2EE6C9', '#FF3D7F', '#FFB547', '#3D8BFF', '#22C38E', '#C04DFF'];

/** Dilim yolu: merkezden açı aralığına (derece, saat yönünde, 0 = yukarı). */
function slice(c: number, r: number, a0: number, a1: number) {
  const p = (a: number) => {
    const rad = ((a - 90) * Math.PI) / 180;
    return `${c + r * Math.cos(rad)} ${c + r * Math.sin(rad)}`;
  };
  return `M ${c} ${c} L ${p(a0)} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${p(a1)} Z`;
}

/**
 * Çark: dilimlerde bayrak (emoji) ve kısa kod. Dönüş açısı dışarıdan (Reanimated)
 * verilir; ok her zaman üstte sabittir.
 */
export function Wheel({ size, labels, rotation }: { size: number; labels: string[]; rotation: SharedValue<number> }) {
  const c = size / 2;
  const r = c - 6;
  const n = Math.max(labels.length, 1);
  const step = 360 / n;
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.get()}deg` }] }));

  return (
    <View style={{ width: size, height: size + 18 }} accessible={false}>
      <Animated.View style={[{ width: size, height: size, marginTop: 18 }, spin]}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="shine" cx={c} cy={c} r={c} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.18" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          <Circle cx={c} cy={c} r={c - 1} fill="#0B1020" stroke="rgba(255,255,255,0.18)" strokeWidth={2} />
          {labels.map((label, i) => {
            const mid = i * step + step / 2;
            const rad = ((mid - 90) * Math.PI) / 180;
            const tr = r * 0.7;
            return (
              <G key={`${label}-${i}`}>
                <Path d={slice(c, r, i * step, (i + 1) * step)} fill={WHEEL_COLORS[i % WHEEL_COLORS.length]} opacity={0.92} stroke="#0B1020" strokeWidth={2} />
                <SvgText
                  x={c + tr * Math.cos(rad)}
                  y={c + tr * Math.sin(rad) + size * 0.035}
                  fontSize={size * 0.1}
                  textAnchor="middle"
                  rotation={mid}
                  origin={`${c + tr * Math.cos(rad)}, ${c + tr * Math.sin(rad)}`}>
                  {label}
                </SvgText>
              </G>
            );
          })}
          <Circle cx={c} cy={c} r={r} fill="url(#shine)" />
          <Circle cx={c} cy={c} r={size * 0.11} fill="#0B1020" stroke="#FFFFFF" strokeOpacity={0.6} strokeWidth={3} />
          <Circle cx={c} cy={c} r={size * 0.04} fill="#FF7A45" />
        </Svg>
      </Animated.View>
      <View style={[styles.pointer, { left: c - 14 }]}>
        <Svg width={28} height={30}>
          <Path d="M 14 30 L 2 4 Q 14 -4 26 4 Z" fill="#FFFFFF" stroke="#FF3D7F" strokeWidth={2} />
        </Svg>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pointer: { position: 'absolute', top: 0, shadowColor: '#FF3D7F', shadowOpacity: 0.7, shadowRadius: 8 },
});
