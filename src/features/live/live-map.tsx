import Ionicons from '@expo/vector-icons/Ionicons';
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

import type { StopStatus } from './live-logic';
import type { LiveMapHandle, LiveMapProps } from './types';

const DONE_GRADIENT = ['#5B6378', '#3A4155'] as const;
const NOW_RING = '#2FD47A';

function markerLook(status: StopStatus | undefined, selected: boolean) {
  const muted = status === 'done' || status === 'skipped' || status === 'past';
  return {
    colors: selected ? Gradients.primary : status === 'now' || status === 'next' ? Gradients.primary : muted ? DONE_GRADIENT : Gradients.night,
    ring: status === 'now' ? NOW_RING : 'rgba(255,255,255,0.9)',
    ringWidth: status === 'now' ? 3 : 2,
    opacity: muted && !selected ? 0.75 : 1,
    icon: status === 'done' ? ('checkmark' as const) : status === 'skipped' ? ('close' as const) : null,
  };
}

/**
 * Seyahat canlı görünümünün haritası: durumuna göre renklenen numaralı duraklar (gidildi, atlandı,
 * şimdi, sıradaki), duraklar arası sıra çizgisi ve konumundan sıradaki durağa gerçek güzergah.
 */
const NativeLiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function NativeLiveMap({ points, selectedId, onSelect, topInset, bottomInset, path, guide, here }, ref) {
  const { colors, isDark } = useTheme();
  const map = useRef<MapView>(null);
  const coords = points.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const pathCoords = path?.map((p) => ({ latitude: p.lat, longitude: p.lng })) ?? [];
  const guideCoords = guide?.coords.map((p) => ({ latitude: p.lat, longitude: p.lng })) ?? [];
  const fitCoords = pathCoords.length > 1 ? pathCoords : coords;
  // Özel işaretler bir kez çizilince takip kapatılır (performans); durum değişince yeniden çizilir.
  const drawKey = `${points.map((p) => `${p.id}:${p.status ?? ''}`).join(',')}|${selectedId}`;
  const [drawn, setDrawn] = useState<string | null>(null);
  useEffect(() => {
    const id = setTimeout(() => setDrawn(drawKey), 600);
    return () => clearTimeout(id);
  }, [drawKey]);

  const padding = { top: topInset + 32, right: 64, bottom: bottomInset + 32, left: 48 };
  const fit = () => {
    if (fitCoords.length > 1) {
      map.current?.fitToCoordinates(fitCoords, { edgePadding: padding, animated: true });
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
    locate: () => {
      if (!here) return;
      // Sıradaki durağa çizgi varsa ikisi birlikte, yoksa yalnızca konum.
      if (guideCoords.length > 1) map.current?.fitToCoordinates(guideCoords, { edgePadding: padding, animated: true });
      else map.current?.animateCamera({ center: { latitude: here.lat, longitude: here.lng }, zoom: 16 }, { duration: 500 });
    },
  }));

  // Gün değişip duraklar yenilenince hepsi yeniden ekrana sığdırılır.
  const pointsKey = `${points.map((p) => p.id).join(',')}|${path?.length ?? 0}`;
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
      showsBuildings
      toolbarEnabled={false}
      onMapReady={fit}>
      {pathCoords.length > 1 ? (
        <Polyline coordinates={pathCoords} strokeColor={colors.primary} strokeWidth={5} lineJoin="round" />
      ) : (
        coords.length > 1 && <Polyline coordinates={coords} strokeColor={isDark ? 'rgba(255,255,255,0.35)' : 'rgba(14,19,36,0.3)'} strokeWidth={3} lineDashPattern={[6, 8]} />
      )}
      {guideCoords.length > 1 &&
        (guide?.mode === 'walk' ? (
          // Yürüyüş: Google'daki gibi iri noktalar (ince alt çizgiyle belirgin).
          <>
            <Polyline coordinates={guideCoords} strokeColor={colors.accent} strokeWidth={2} lineJoin="round" />
            <Polyline coordinates={guideCoords} strokeColor={colors.accent} strokeWidth={7} lineCap="round" lineDashPattern={[1, 14]} />
          </>
        ) : (
          <Polyline coordinates={guideCoords} strokeColor={colors.accent} strokeWidth={6} lineJoin="round" lineCap="round" />
        ))}
      {points.map((p) => {
        const selected = p.id === selectedId;
        const size = selected ? 44 : 32;
        const look = markerLook(p.status, selected);
        return (
          <Marker
            key={p.id}
            identifier={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={() => onSelect(p.id)}
            tracksViewChanges={drawn !== drawKey || selected}
            zIndex={selected ? 10 : p.status === 'now' || p.status === 'next' ? 5 : 1}
            anchor={{ x: 0.5, y: 0.5 }}
            accessibilityLabel={p.title}>
            <View style={{ opacity: look.opacity }}>
              <LinearGradient
                colors={look.colors}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.pin, { width: size, height: size, borderRadius: size / 2, borderColor: look.ring, borderWidth: look.ringWidth }]}>
                {look.icon ? (
                  <Ionicons name={look.icon} size={selected ? 22 : 17} color="#FFFFFF" />
                ) : (
                  <Text variant="caption" style={[styles.pinText, { fontSize: selected ? 16 : 13 }]}>
                    {p.label}
                  </Text>
                )}
              </LinearGradient>
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
});

const styles = StyleSheet.create({
  pin: { alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  pinText: { color: '#FFFFFF', fontWeight: '800', lineHeight: 18 },
});

/** Android'de harita anahtarı yoksa sade çizim yedeği (aksi halde uygulama çöker). */
const FallbackLiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function FallbackLiveMap({ points, onSelect, topInset }, ref) {
  useImperativeHandle(ref, () => ({ fit: () => {}, focus: () => {}, locate: () => {} }));
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topInset }]}>
      <PlacesMap points={points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.title, label: p.label, locked: p.locked }))} height={320} onSelect={onSelect} />
    </View>
  );
});

export const LiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap(props, ref) {
  return nativeMapsAvailable ? <NativeLiveMap ref={ref} {...props} /> : <FallbackLiveMap ref={ref} {...props} />;
});
