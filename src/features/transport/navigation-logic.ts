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
