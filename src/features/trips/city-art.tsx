import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';

/** Şehir adına göre seçilen renk takımları (aynı şehir hep aynı görünür). */
const PALETTES = [
  { from: '#FF7A45', to: '#C2185B', glow: '#FFD166' }, // gün batımı
  { from: '#3A1C71', to: '#D76D77', glow: '#FFAF7B' }, // mor akşam
  { from: '#0F4C75', to: '#1BC7B0', glow: '#9BFFEA' }, // okyanus
  { from: '#5B2EFF', to: '#FF3D7F', glow: '#C6B5FF' }, // neon
  { from: '#0B486B', to: '#F56217', glow: '#FFC371' }, // akdeniz
  { from: '#1D2671', to: '#C33764', glow: '#FF9A9E' }, // gece şehri
] as const;

export function paletteFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTES[h % PALETTES.length];
}

/** Seyahat kartının arka planı: geçiş, ışık, yörünge halkaları ve kesikli uçuş rotası. */
export function CityArt({ seed, id }: { seed: string; id: string }) {
  const p = paletteFor(seed.toLowerCase());
  const key = id.replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%" viewBox="0 0 360 220" preserveAspectRatio="xMidYMid slice">
        <Defs>
          <LinearGradient id={`bg${key}`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={p.from} />
            <Stop offset="1" stopColor={p.to} />
          </LinearGradient>
          <RadialGradient id={`gl${key}`} cx="290" cy="40" r="170" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor={p.glow} stopOpacity="0.75" />
            <Stop offset="1" stopColor={p.glow} stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id={`fade${key}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0.35" stopColor="#000" stopOpacity="0" />
            <Stop offset="1" stopColor="#000" stopOpacity="0.45" />
          </LinearGradient>
        </Defs>
        <Rect width="360" height="220" fill={`url(#bg${key})`} />
        <Rect width="360" height="220" fill={`url(#gl${key})`} />
        {[60, 100, 140, 180].map((r) => (
          <Circle key={r} cx="300" cy="44" r={r} stroke="#FFFFFF" strokeOpacity={0.16 - r / 2000} strokeWidth="1" fill="none" />
        ))}
        <Path d="M 20 190 Q 160 40 330 70" stroke="#FFFFFF" strokeOpacity="0.55" strokeWidth="1.6" strokeDasharray="2 7" strokeLinecap="round" fill="none" />
        <Circle cx="20" cy="190" r="4" fill="#FFFFFF" fillOpacity="0.85" />
        <Circle cx="330" cy="70" r="5" fill="#FFFFFF" />
        <Circle cx="330" cy="70" r="11" stroke="#FFFFFF" strokeOpacity="0.5" fill="none" />
        <Rect width="360" height="220" fill={`url(#fade${key})`} />
      </Svg>
    </View>
  );
}
