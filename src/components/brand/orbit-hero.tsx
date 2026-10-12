import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Stop } from 'react-native-svg';

import { LogoMark } from './logo-mark';

/** Hareketli yörünge: ortada logo, etrafında dönen uçak ve noktalar. */
function Orbit({ size, duration, reverse = false, children }: { size: number; duration: number; reverse?: boolean; children: React.ReactNode }) {
  const r = useSharedValue(0);
  useEffect(() => {
    r.set(withRepeat(withTiming(360, { duration, easing: Easing.linear }), -1, false));
  }, [r, duration]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${reverse ? -r.get() : r.get()}deg` }] }));
  return <Animated.View style={[styles.orbit, { width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>{children}</Animated.View>;
}

/** Açılış ekranının üstündeki görsel: ışıklı gezegen, yörüngeler ve dönen uçak. */
export function OrbitHero({ size = 300 }: { size?: number }) {
  const c = size / 2;
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id="halo" cx={c} cy={c} r={c} gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FF6B4A" stopOpacity="0.45" />
            <Stop offset="0.55" stopColor="#7C5CFF" stopOpacity="0.16" />
            <Stop offset="1" stopColor="#7C5CFF" stopOpacity="0" />
          </RadialGradient>
          <LinearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF7A45" stopOpacity="0.9" />
            <Stop offset="1" stopColor="#2EE6C9" stopOpacity="0.5" />
          </LinearGradient>
        </Defs>
        <Circle cx={c} cy={c} r={c} fill="url(#halo)" />
        <Circle cx={c} cy={c} r={c * 0.86} stroke="url(#ring)" strokeOpacity={0.35} strokeWidth={1} fill="none" strokeDasharray="2 8" />
        <Circle cx={c} cy={c} r={c * 0.64} stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1} fill="none" />
        <Circle cx={c} cy={c} r={c * 0.44} stroke="#FFFFFF" strokeOpacity={0.08} strokeWidth={1} fill="none" />
      </Svg>
      <Orbit size={size * 0.86} duration={18000}>
        <View style={[styles.plane, { left: size * 0.43 - 16, top: -16 }]}>
          <Ionicons name="airplane" size={18} color="#FFFFFF" style={{ transform: [{ rotate: '90deg' }] }} />
        </View>
      </Orbit>
      <Orbit size={size * 0.64} duration={11000} reverse>
        <View style={[styles.dot, { backgroundColor: '#2EE6C9', left: -5, top: size * 0.32 - 5 }]} />
        <View style={[styles.dot, styles.small, { backgroundColor: '#FFB547', right: size * 0.05, top: size * 0.06 }]} />
      </Orbit>
      <View style={[styles.center, { left: c - 48, top: c - 48 }]}>
        <LogoMark size={96} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  orbit: { position: 'absolute', left: '50%', top: '50%' },
  plane: { position: 'absolute', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FF5A6E', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', shadowColor: '#FF5A6E', shadowOpacity: 0.8, shadowRadius: 10 },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  small: { width: 7, height: 7 },
  center: { position: 'absolute', borderRadius: 28, shadowColor: '#FF6B4A', shadowOpacity: 0.6, shadowRadius: 30, shadowOffset: { width: 0, height: 10 } },
});
