import { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';

import { Text } from '@/components/ui/text';
import { Radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import type { PlacesMapProps } from './types';

/**
 * Durakları numaralı işaretlerle ve sırasıyla çizgiyle gösterir. iOS'ta Apple
 * Haritalar, Android'de Google Haritalar kullanılır.
 */
export function PlacesMap({ points, height = 220, onSelect }: PlacesMapProps) {
  const { colors, isDark } = useTheme();
  const ref = useRef<MapView>(null);
  if (points.length === 0) return null;

  const first = points[0];
  const fit = () =>
    ref.current?.fitToCoordinates(
      points.map((p) => ({ latitude: p.lat, longitude: p.lng })),
      { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false },
    );

  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <MapView
        ref={ref}
        style={StyleSheet.absoluteFill}
        initialRegion={{ latitude: first.lat, longitude: first.lng, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
        onMapReady={points.length > 1 ? fit : undefined}
        userInterfaceStyle={isDark ? 'dark' : 'light'}
        showsUserLocation
        toolbarEnabled={false}
        accessibilityLabel={points.map((p) => p.title).join(', ')}>
        {points.length > 1 && (
          <Polyline coordinates={points.map((p) => ({ latitude: p.lat, longitude: p.lng }))} strokeColor={colors.primary} strokeWidth={3} lineDashPattern={[6, 6]} />
        )}
        {points.map((p) => (
          <Marker
            key={p.id}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            title={p.title}
            description={p.subtitle ?? undefined}
            onCalloutPress={onSelect ? () => onSelect(p.id) : undefined}
            tracksViewChanges={false}>
            <View style={[styles.pin, { backgroundColor: p.locked ? colors.text : colors.primary, borderColor: colors.surface }]}>
              <Text variant="caption" style={[styles.pinText, { color: colors.onPrimary }]}>
                {p.label ?? '•'}
              </Text>
            </View>
          </Marker>
        ))}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  pin: { minWidth: 28, height: 28, paddingHorizontal: 6, borderRadius: Radius.pill, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pinText: { fontWeight: '700', fontSize: 12, lineHeight: 16 },
});
