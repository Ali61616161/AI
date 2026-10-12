import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/theme/use-theme';

import { distanceM, type ExploreMapHandle, type ExploreMapProps } from './types';

/**
 * Web'de yerel harita yok; yerler merkeze göre yön ve mesafeleriyle dönen bir
 * radarda gösterilir. Dokunulan nokta seçilir (telefonda gerçek harita açılır).
 */
export const RadarMap = forwardRef<ExploreMapHandle, ExploreMapProps>(function RadarMap({ center, places, selectedId, onSelect, bottomInset, topInset }, ref) {
  const { colors } = useTheme();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const sweep = useSharedValue(0);
  useImperativeHandle(ref, () => ({ flyTo: () => undefined }));
  useEffect(() => {
    sweep.set(withRepeat(withTiming(360, { duration: 4200, easing: Easing.linear }), -1, false));
  }, [sweep]);
  const sweepStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${sweep.get()}deg` }] }));

  const areaH = Math.max(size.h - bottomInset - topInset, 0);
  const R = Math.min(size.w, areaH) / 2 - 24;
  const cx = size.w / 2;
  const cy = topInset + areaH / 2;
  const maxD = Math.max(800, ...places.map((p) => (p.lat === null || p.lng === null ? 0 : distanceM(center, { lat: p.lat, lng: p.lng }))));

  const blips = places.flatMap((p) => {
    if (p.lat === null || p.lng === null) return [];
    const d = distanceM(center, { lat: p.lat, lng: p.lng });
    const angle = Math.atan2(p.lng - center.lng, p.lat - center.lat);
    const r = (d / maxD) * R * 0.92;
    return [{ id: p.id, x: cx + Math.sin(angle) * r, y: cy - Math.cos(angle) * r }];
  });

  return (
    <View style={StyleSheet.absoluteFill} onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
      {R > 0 && (
        <>
          <Svg width={size.w} height={size.h} style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="core" cx={cx} cy={cy} r={R} gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor="#2EE6C9" stopOpacity="0.16" />
                <Stop offset="1" stopColor="#2EE6C9" stopOpacity="0" />
              </RadialGradient>
            </Defs>
            <Circle cx={cx} cy={cy} r={R} fill="url(#core)" />
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <Circle key={f} cx={cx} cy={cy} r={R * f} stroke="#2EE6C9" strokeOpacity={0.22} strokeWidth={1} fill="none" />
            ))}
            <Line x1={cx - R} y1={cy} x2={cx + R} y2={cy} stroke="#2EE6C9" strokeOpacity={0.12} />
            <Line x1={cx} y1={cy - R} x2={cx} y2={cy + R} stroke="#2EE6C9" strokeOpacity={0.12} />
            <Circle cx={cx} cy={cy} r={7} fill="#2EE6C9" />
            <Circle cx={cx} cy={cy} r={14} stroke="#2EE6C9" strokeOpacity={0.5} fill="none" />
          </Svg>
          <Animated.View pointerEvents="none" style={[styles.sweep, { left: cx - R, top: cy - R, width: R * 2, height: R * 2 }, sweepStyle]}>
            <View style={[styles.beam, { width: R, height: 2, left: R, top: R - 1 }]} />
          </Animated.View>
          {blips.map((b) => {
            const selected = b.id === selectedId;
            const s = selected ? 22 : 14;
            return (
              <Pressable key={b.id} accessibilityRole="button" onPress={() => onSelect(b.id)} hitSlop={10} style={[styles.blip, { left: b.x - s / 2, top: b.y - s / 2, width: s, height: s, borderRadius: s / 2, backgroundColor: selected ? colors.primary : '#FFFFFF', shadowColor: selected ? colors.primary : '#2EE6C9' }]} />
            );
          })}
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  sweep: { position: 'absolute' },
  beam: { position: 'absolute', backgroundColor: '#2EE6C9', opacity: 0.6, shadowColor: '#2EE6C9', shadowOpacity: 1, shadowRadius: 12 },
  blip: { position: 'absolute', borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', shadowOpacity: 0.9, shadowRadius: 10 },
});
