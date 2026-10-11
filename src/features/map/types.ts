export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  subtitle?: string | null;
  /** Haritadaki sıra numarası (gün planında durak sırası). */
  label?: string;
  locked?: boolean;
};

export type PlacesMapProps = {
  points: MapPoint[];
  height?: number;
  onSelect?: (id: string) => void;
};
