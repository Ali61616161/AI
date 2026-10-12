import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { Place } from '@/features/places/api';

export type Coords = { lat: number; lng: number };

export type ExploreMapHandle = {
  /** Kamerayı bir noktaya yumuşakça götürür. */
  flyTo: (c: Coords) => void;
};

export type ExploreMapProps = {
  center: Coords;
  user: Coords | null;
  places: Place[];
  selectedId: string | null;
  icon: ComponentProps<typeof Ionicons>['name'];
  onSelect: (id: string) => void;
  /** Kullanıcı haritayı kaydırıp bıraktığında yeni merkez. */
  onMove: (c: Coords) => void;
  /** Alttaki kartlar haritanın bu kadarını kaplar (işaretler arkada kalmasın). */
  bottomInset: number;
  topInset: number;
};

/** İki nokta arası metre (haversine). */
export function distanceM(a: Coords, b: Coords): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
