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

// ---------------------------------------------------------------------------
// Akıcı takip: konum güncellemeleri arasında kamera, hız ve yöne göre öne doğru kayar
// ---------------------------------------------------------------------------

export type Fix = { lat: number; lng: number; heading: number | null; speed: number | null; at: number };

const M_PER_DEG = 111_320;

/** Bir noktadan verilen yönde (0 = kuzey, saat yönü) `meters` ileri nokta. */
export function destinationPoint(p: LatLng, headingDeg: number, meters: number): LatLng {
  const rad = (headingDeg * Math.PI) / 180;
  return {
    lat: p.lat + (Math.cos(rad) * meters) / M_PER_DEG,
    lng: p.lng + (Math.sin(rad) * meters) / (M_PER_DEG * Math.cos((p.lat * Math.PI) / 180)),
  };
}

/** Bu hızın (m/sn) altında yön güvenilmez; kamera olduğu gibi kalır. */
export const MOVING_MS = 0.7;

/**
 * Son konum bilgisinden şimdiki tahmini konum: hız ve yöne göre ilerletilir (en fazla `maxSec` sn),
 * böylece konum 1-2 sn'de bir gelse de harita sıçramadan akar.
 */
export function predictPosition(fix: Fix, nowMs: number, maxSec = 2.5): LatLng {
  if (fix.heading === null || fix.speed === null || fix.speed < MOVING_MS) return { lat: fix.lat, lng: fix.lng };
  const sec = Math.max(0, Math.min((nowMs - fix.at) / 1000, maxSec));
  return destinationPoint(fix, fix.heading, Math.min(fix.speed, 45) * sec);
}

/** İki yön arasında en kısa yoldan yumuşak geçiş (0-360). */
export function blendHeading(prev: number, next: number, alpha: number): number {
  const diff = ((((next - prev) % 360) + 540) % 360) - 180;
  return (prev + diff * alpha + 360) % 360;
}

/** Hıza göre yakınlaştırma: yürürken yakın, arabayla uzak. */
export function zoomForSpeed(speed: number | null): number {
  if (speed === null || speed < 3) return 18;
  if (speed < 9) return 17.5;
  if (speed < 18) return 17;
  return 16.3;
}

/** Konumun çizgiye izdüşümünden böler: geçilen kısım ve kalan kısım (çizgi parçaları listesi). */
export function splitAtNearest(parts: LatLng[][], here: LatLng): { passed: LatLng[][]; rest: LatLng[][] } {
  const mLng = M_PER_DEG * Math.cos((here.lat * Math.PI) / 180);
  let best = { d: Infinity, part: -1, seg: -1, t: 0 };
  parts.forEach((pts, pi) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const ax = pts[i].lng * mLng;
      const ay = pts[i].lat * M_PER_DEG;
      const dx = pts[i + 1].lng * mLng - ax;
      const dy = pts[i + 1].lat * M_PER_DEG - ay;
      const len2 = dx * dx + dy * dy;
      const px = here.lng * mLng - ax;
      const py = here.lat * M_PER_DEG - ay;
      const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, (px * dx + py * dy) / len2));
      const d = Math.hypot(px - t * dx, py - t * dy);
      if (d < best.d) best = { d, part: pi, seg: i, t };
    }
  });
  if (best.part < 0) return { passed: [], rest: parts };
  const pts = parts[best.part];
  const a = pts[best.seg];
  const b = pts[best.seg + 1];
  const cut = { lat: a.lat + (b.lat - a.lat) * best.t, lng: a.lng + (b.lng - a.lng) * best.t };
  return {
    passed: [...parts.slice(0, best.part), [...pts.slice(0, best.seg + 1), cut]],
    rest: [[cut, ...pts.slice(best.seg + 1)], ...parts.slice(best.part + 1)],
  };
}

/**
 * Konumdan rotanın sonuna ROTA BOYUNCA kalan mesafe (metre): konum çizgiye izdüşürülür, kalan doğru parçalarının
 * uzunlukları toplanır. Kuş uçuşu mesafeden farklı olarak ekrandaki "kalan" rota süresiyle tutarlıdır.
 * Çizgi boşsa ya da konum yoksa null.
 */
export function remainingAlongPath(here: LatLng | null, path: LatLng[]): number | null {
  if (!here || path.length === 0) return null;
  if (path.length === 1) return Math.round(distanceKm(here, path[0]) * 1000);
  const mLng = M_PER_DEG * Math.cos((here.lat * Math.PI) / 180);
  const px = here.lng * mLng;
  const py = here.lat * M_PER_DEG;
  let best = { d: Infinity, seg: 0, t: 0 };
  for (let i = 0; i < path.length - 1; i++) {
    const ax = path[i].lng * mLng;
    const ay = path[i].lat * M_PER_DEG;
    const dx = path[i + 1].lng * mLng - ax;
    const dy = path[i + 1].lat * M_PER_DEG - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * (dx) + (py - ay) * dy) / len2));
    const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    if (d < best.d) best = { d, seg: i, t };
  }
  const seg = (i: number) => Math.hypot((path[i + 1].lng - path[i].lng) * mLng, (path[i + 1].lat - path[i].lat) * M_PER_DEG);
  let total = seg(best.seg) * (1 - best.t);
  for (let i = best.seg + 1; i < path.length - 1; i++) total += seg(i);
  return Math.round(total);
}
