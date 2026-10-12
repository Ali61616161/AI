import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { Gradients } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { DARK_MAP_STYLE } from './map-style';
import type { ExploreMapHandle, ExploreMapProps } from './types';

/** Seçili işaretin etrafında nabız gibi büyüyüp sönen halka. */
function Pulse() {
  const p = useSharedValue(0);
  useEffect(() => {
    p.set(withRepeat(withTiming(1, { duration: 1400 }), -1, false));
  }, [p]);
  const style = useAnimatedStyle(() => ({ opacity: 0.6 * (1 - p.get()), transform: [{ scale: 0.6 + p.get() * 1.1 }] }));
  return <Animated.View pointerEvents="none" style={[styles.pulse, style]} />;
}

function Pin({ selected, icon }: { selected: boolean; icon: ExploreMapProps['icon'] }) {
  const size = selected ? 46 : 34;
  return (
    <View style={styles.pinWrap}>
      {selected && <Pulse />}
      <LinearGradient colors={selected ? Gradients.primary : Gradients.night} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.pin, { width: size, height: size, borderRadius: size / 2 }]}>
        <Ionicons name={icon} size={selected ? 22 : 16} color="#FFFFFF" />
      </LinearGradient>
    </View>
  );
}

/**
 * Canlı keşif haritası: koyu tema, hafif eğik (3D) kamera, kullanıcının canlı konumu
 * ve şu an açık yerler. iOS'ta Apple Haritalar, Android'de Google Haritalar.
 */
export const ExploreMap = forwardRef<ExploreMapHandle, ExploreMapProps>(function ExploreMap(
  { center, places, selectedId, icon, onSelect, onMove, bottomInset, topInset },
  ref,
) {
  const { isDark } = useTheme();
  const map = useRef<MapView>(null);
  // Android'de özel işaret görünümü bir kez çizilince takip kapatılır (performans).
  const drawKey = `${places.map((p) => p.id).join(',')}|${selectedId}`;
  const [drawn, setDrawn] = useState<string | null>(null);
  const tracks = drawn !== drawKey;
  useEffect(() => {
    const id = setTimeout(() => setDrawn(drawKey), 600);
    return () => clearTimeout(id);
  }, [drawKey]);

  useImperativeHandle(ref, () => ({
    flyTo: (c) => map.current?.animateCamera({ center: { latitude: c.lat, longitude: c.lng } }, { duration: 650 }),
  }));

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialCamera={{ center: { latitude: center.lat, longitude: center.lng }, pitch: 50, heading: 0, altitude: 1600, zoom: 15 }}
      userInterfaceStyle={isDark ? 'dark' : 'light'}
      customMapStyle={Platform.OS === 'android' && isDark ? DARK_MAP_STYLE : undefined}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      showsBuildings
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      pitchEnabled
      mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
      onRegionChangeComplete={(r, details) => {
        if (details?.isGesture !== false) onMove({ lat: r.latitude, lng: r.longitude });
      }}>
      {places.map((p) =>
        p.lat === null || p.lng === null ? null : (
          <Marker
            key={p.id}
            identifier={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => onSelect(p.id)}
            tracksViewChanges={tracks || p.id === selectedId}
            zIndex={p.id === selectedId ? 10 : 1}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={p.name}>
            <Pin selected={p.id === selectedId} icon={icon} />
          </Marker>
        ),
      )}
    </MapView>
  );
});

const styles = StyleSheet.create({
  pinWrap: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  pulse: { position: 'absolute', width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF5A6E' },
});
