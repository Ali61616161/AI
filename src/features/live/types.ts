export type LivePoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  /** Haritadaki sıra numarası (gün planında durak sırası). */
  label: string;
  locked?: boolean;
};

export type LiveMapHandle = {
  /** Seçilen durağa yaklaşır. */
  focus: (id: string) => void;
  /** Günün bütün duraklarını ekrana sığdırır. */
  fit: () => void;
};

export type LiveMapProps = {
  points: LivePoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Üstteki (gün seçici) ve alttaki (durak kartları) kaplanan alan; harita içeriği bunların dışına sığdırılır. */
  topInset: number;
  bottomInset: number;
};
