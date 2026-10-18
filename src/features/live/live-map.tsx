import { LinearGradient } from 'expo-linear-gradient';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Text } from '@/components/ui/text';
import { DARK_MAP_STYLE } from '@/features/explore/map-style';
import { mapProvider, nativeMapsAvailable, usesGoogleMap } from '@/features/map/availability';
import { PlacesMap } from '@/features/map/places-map';
import { Gradients } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { LiveMapHandle, LiveMapProps } from './types';

/** Seyahat canlı görünümünün haritası: numaralı duraklar, sıralı çizgi, seçili durak vurgulu. */
const NativeLiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function NativeLiveMap({ points, selectedId, onSelect, topInset, bottomInset }, ref) {
  const { colors, isDark } = useTheme();
  const map = useRef<MapView>(null);
  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  // Özel işaretler Android'de bir kez çizilince takip kapatılır (performans).
  const drawKey = `${points.map((p) => p.id).join(',')}|${selectedId}`;
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDrawn(drawKey), 600);
    return () => clearTimeout(id);
  }, [drawKey]);

  const fit = () => {
    if (coords.length > 1) {
      map.current?.fitToCoordinates(coords, { edgePadding: { top: topInset + 32, right: 48, bottom: bottomInset + 32, left: 48 }, animated: true });
    } else if (coords[0]) {
      map.current?.animateToRegion({ ...coords[0], latitudeDelta: 0.01, longitudeDelta: 0.01 }, 400);
    }
  };

  useImperativeHandle(ref, () => ({
    fit,
    focus: (id) => {
      const p = points.find((x) => x.id === id);
      if (p) map.current?.animateCamera({ center: { latitude: p.lat, longitude: p.lng }, zoom: 16 }, { duration: 500 });
    },
  }));

  // Gün değişip duraklar yenilenince hepsi yeniden ekrana sığdırılır.
  const pointsKey = points.map((p) => p.id).join(',');
  useEffect(() => {
    const id = setTimeout(fit, 250);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointsKey]);

  return (
    <MapView
      provider={mapProvider}
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={coords[0] ? { ...coords[0], latitudeDelta: 0.05, longitudeDelta: 0.05 } : undefined}
      userInterfaceStyle={isDark ? 'dark' : 'light'}
      customMapStyle={usesGoogleMap && isDark ? DARK_MAP_STYLE : undefined}
      showsUserLocation
      showsMyLocationButton={false}
      showsCompass={false}
      showsPointsOfInterests={false}
      toolbarEnabled={false}
      onMapReady={fit}>
      {coords.length > 1 && <Polyline coordinates={coords} strokeColor={colors.primary} strokeWidth={4} lineDashPattern={[8, 8]} />}
      {points.map((p) => {
        const selected = p.id === selectedId;
        const size = selected ? 42 : 32;
        return (
          <Marker
            key={p.id}
            identifier={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => onSelect(p.id)}
            tracksViewChanges={drawn !== drawKey || selected}
            zIndex={selected ? 10 : 1}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={p.title}>
            <LinearGradient
              colors={selected ? Gradients.primary : Gradients.night}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.pin, { width: size, height: size, borderRadius: size / 2 }]}>
              <Text variant="caption" style={[styles.pinText, { fontSize: selected ? 16 : 13 }]}>
                {p.label}
              </Text>
            </LinearGradient>
          </Marker>
        );
      })}
    </MapView>
  );
});

const styles = StyleSheet.create({
  pin: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'rgba(255,255,255,0.9)', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  pinText: { color: '#FFFFFF', fontWeight: '800', lineHeight: 18 },
});

/** Android'de harita anahtarı yoksa sade çizim yedeği (aksi halde uygulama çöker). */
const FallbackLiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function FallbackLiveMap({ points, onSelect, topInset }, ref) {
  useImperativeHandle(ref, () => ({ fit: () => {}, focus: () => {} }));
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topInset }]}>
      <PlacesMap points={points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.title, label: p.label, locked: p.locked }))} height={320} onSelect={onSelect} />
    </View>
  );
});

export const LiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap(props, ref) {
  return nativeMapsAvailable ? <NativeLiveMap ref={ref} {...props} /> : <FallbackLiveMap ref={ref} {...props} />;
});
