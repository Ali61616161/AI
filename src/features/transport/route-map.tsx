import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LiveMap } from '@/features/live/live-map';
import { Radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { decodePolyline, thin } from './polyline';

/** Seçili rotanın uygulama içi haritası: güzergah çizgisi, başlangıç (A) ve varış (B) işaretleri. */
export function RouteMap({ polyline, height = 240 }: { polyline: string | null; height?: number }) {
  const { colors } = useTheme();
  const path = useMemo(() => (polyline ? thin(decodePolyline(polyline)) : []), [polyline]);
  if (path.length < 2) return null;
  const first = path[0];
  const last = path[path.length - 1];
  return (
    <View style={[styles.wrap, { height, borderColor: colors.border }]}>
      <LiveMap
        points={[
          { id: 'from', lat: first.lat, lng: first.lng, title: 'A', label: 'A' },
          { id: 'to', lat: last.lat, lng: last.lng, title: 'B', label: 'B' },
        ]}
        selectedId="to"
        onSelect={() => {}}
        path={path}
        topInset={0}
        bottomInset={0}
      />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' } });
