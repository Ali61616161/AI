import type { StopStatus } from './live-logic';

export type LivePoint = {
  id: string;
  lat: number;
  lng: number;
  title: string;
  /** Haritadaki sıra numarası (gün planında durak sırası). */
  label: string;
  locked?: boolean;
  /** Bugünse durağın durumu (gittim, atlandı, şimdi, sıradaki…); işaretin rengi ve simgesi buna göre. */
  status?: StopStatus;
};

/** Konumundan sıradaki durağa gerçek güzergah çizgisi (Google Routes). */
export type LiveGuide = { coords: { lat: number; lng: number }[]; mode: 'walk' | 'transit' | 'drive' };

export type LiveMapHandle = {
  /** Seçilen durağa yaklaşır. */
  focus: (id: string) => void;
  /** Günün bütün duraklarını ekrana sığdırır. */
  fit: () => void;
  /** Kullanıcının konumuna (ve varsa sıradaki durağa) yaklaşır. */
  locate: () => void;
};

export type LiveMapProps = {
  points: LivePoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Verilirse rota çizgisi olarak çizilir ve harita bu çizgiye sığdırılır (duraklar arası kesik çizgi yerine). */
  path?: { lat: number; lng: number }[];
  /** Konumdan sıradaki durağa çizgi; haritanın sığdırılmasını değiştirmez. */
  guide?: LiveGuide | null;
  /** Kullanıcının konumu ("beni göster" için). */
  here?: { lat: number; lng: number } | null;
  /** Üstteki (gün seçici) ve alttaki (durak kartları) kaplanan alan; harita içeriği bunların dışına sığdırılır. */
  topInset: number;
  bottomInset: number;
};
