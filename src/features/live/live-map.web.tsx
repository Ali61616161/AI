import { forwardRef, useImperativeHandle } from 'react';
import { StyleSheet, View } from 'react-native';

import { PlacesMap } from '@/features/map/places-map';

import type { LiveMapHandle, LiveMapProps } from './types';

/** Web önizlemesi: yerel harita yok; duraklar sırayla çizilen yedek görünümle gösterilir. */
export const LiveMap = forwardRef<LiveMapHandle, LiveMapProps>(function LiveMap({ points, onSelect, topInset }, ref) {
  useImperativeHandle(ref, () => ({ fit: () => {}, focus: () => {} }));
  return (
    <View style={[StyleSheet.absoluteFill, { paddingTop: topInset }]}>
      <PlacesMap points={points.map((p) => ({ id: p.id, lat: p.lat, lng: p.lng, title: p.title, label: p.label, locked: p.locked }))} height={320} onSelect={onSelect} />
    </View>
  );
});
