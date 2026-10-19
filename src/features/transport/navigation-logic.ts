// Uygulama içi gezinme için saf mantık (arayüz bağımlılığı yok; testlenebilir).
import { distanceKm } from './route-origin.ts';

type LatLng = { lat: number; lng: number };

/** Bu mesafeden yakındaysa kullanıcı o şehirdedir: "Konumum" varsayılan başlangıç olur. */
export const NEAR_KM = 30;

export type FromChoice = 'here' | 'prev';

/**
 * Plan durağından açılan rotada başlangıç seçimi: kullanıcı hedefe yakınsa gerçekten orada
 * olduğu için konumu; uzaktaysa (yarını planlıyor) ya da konum yoksa önceki durak.
 */
export function defaultFromChoice(here: LatLng | null, dest: LatLng | null, hasPrev: boolean): FromChoice {
  if (!hasPrev) return 'here';
  if (here && dest && distanceKm(here, dest) <= NEAR_KM) return 'here';
  return 'prev';
}

/** Rota çizgisinin sonuna kalan kuş uçuşu mesafe (metre); çizgi boşsa null. */
export function remainingMeters(here: LatLng | null, path: LatLng[]): number | null {
  if (!here || path.length === 0) return null;
  return Math.round(distanceKm(here, path[path.length - 1]) * 1000);
}

/** Hedefe bu kadar yaklaşılınca varıldı sayılır. */
export const ARRIVED_M = 40;
export const isArrived = (remaining: number | null) => remaining !== null && remaining <= ARRIVED_M;

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}

/** Rotanın başına bu kadar uzaksan canlı takip yerine önizleme gösterilir. */
export const OFF_ROUTE_M = 2000;

/** Konum rotanın hiçbir yerine yakın değil mi (ör. başka şehirdeyken uzak bir rotayı açtın)? */
export function isOffRoute(here: LatLng | null, path: LatLng[]): boolean {
  const d = distanceToPathM(here, path);
  return d !== null && d > OFF_ROUTE_M;
}

/** Konuma en yakın çizgi noktasının sırası (yoksa 0). */
export function nearestIndex(here: LatLng | null, path: LatLng[]): number {
  if (!here || path.length === 0) return 0;
  let best = 0;
  let bestKm = Infinity;
  for (let i = 0; i < path.length; i++) {
    const km = distanceKm(here, path[i]);
    if (km < bestKm) {
      bestKm = km;
      best = i;
    }
  }
  return best;
}

/** Konum hangi adımın çizgisine en yakınsa o adımın sırası; hiçbirinin çizgisi yoksa `fallback`. */
export function currentStepIndex(here: LatLng | null, stepPaths: LatLng[][], fallback: number): number {
  if (!here) return fallback;
  let best = -1;
  let bestKm = Infinity;
  stepPaths.forEach((path, i) => {
    for (const p of path) {
      const km = distanceKm(here, p);
      if (km < bestKm) {
        bestKm = km;
        best = i;
      }
    }
  });
  return best === -1 ? fallback : best;
}

export type TurnIcon = 'left' | 'right' | 'straight' | 'uturn';

/** Google manevra kodunu dört simgeden birine çevirir. */
export function turnIcon(maneuver: string | null | undefined): TurnIcon {
  const m = maneuver ?? '';
  if (m.startsWith('UTURN')) return 'uturn';
  if (m.includes('LEFT')) return 'left';
  if (m.includes('RIGHT')) return 'right';
  return 'straight';
}

/** Bu mesafeden (m) fazla rotadan uzaklaşılırsa yeniden hesaplanır. */
export const REROUTE_M = 80;

/** Konumun rota çizgisine en kısa mesafesi (metre): her doğru parçasına dik uzaklık. Çizgi boşsa null. */
export function distanceToPathM(here: LatLng | null, path: LatLng[]): number | null {
  if (!here || path.length === 0) return null;
  if (path.length === 1) return Math.round(distanceKm(here, path[0]) * 1000);
  // Yerel düzlem yaklaşımı (kısa mesafelerde yeterli): enlem/boylam metreye çevrilir.
  const mPerLat = 111_320;
  const mPerLng = 111_320 * Math.cos((here.lat * Math.PI) / 180);
  const px = here.lng * mPerLng;
  const py = here.lat * mPerLat;
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i].lng * mPerLng;
    const ay = path[i].lat * mPerLat;
    const bx = path[i + 1].lng * mPerLng;
    const by = path[i + 1].lat * mPerLat;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best) best = d;
  }
  return Math.round(best);
}
