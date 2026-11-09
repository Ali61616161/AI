// "Şu an hangi araçtasın?": konum, hız ve rota çizgisinden toplu taşıma eşleştirmesi (saf mantık; testlenebilir).
import { distanceToPathM } from '../transport/navigation-logic.ts';
import { distanceKm } from '../transport/route-origin.ts';

type LatLng = { lat: number; lng: number };
export type VehicleKind = 'train' | 'high_speed_train' | 'subway' | 'tram' | 'bus' | 'ferry' | 'cable_car' | 'funicular' | 'other';

export type RideFix = LatLng & { speed: number | null; at: number };

/** Rotanın bir toplu taşıma adımı (çizgisi çözülmüş). */
export type RideStep = {
  /** Aynı rotadaki adım sırası. */
  index: number;
  vehicle: VehicleKind;
  line: string | null;
  headsign: string | null;
  from: string | null;
  to: string | null;
  path: LatLng[];
};

export type RideState =
  | { kind: 'unknown' }
  | { kind: 'walking'; speedMs: number }
  /** Durakta bekliyor: hız ~0 ve bir toplu taşıma adımının başlangıcına yakın. */
  | { kind: 'waiting'; step: RideStep; speedMs: number }
  /** Araçta: hız yeterli ve konum bir adımın çizgisinin üstünde. `sure`: art arda iki konum aynı adımı gösteriyor. */
  | { kind: 'riding'; step: RideStep; speedMs: number; sure: boolean }
  /** Hızlı hareket ediyor ama bilinen bir rota çizgisinde değil (başka araç, taksi…). */
  | { kind: 'moving'; speedMs: number };

/** Konum çizgiye bu kadar yakınsa (m) çizgideki araçta sayılır. GPS sapması + yol genişliği payı. */
export const ON_PATH_M = 60;
/** Durağa bu kadar yakınsa (m) bekliyor sayılır. */
export const AT_STOP_M = 90;
/** Bunun altı (m/s ≈ 4 km/h) duruyor sayılır; üstü ve RIDING_MIN_MS altı yürüyüş. */
export const STILL_MS = 0.6;
export const RIDING_MIN_MS = 3;
/** Konumlar arası bu kadar (sn) eskiyse hız hesaplanmaz. */
const MAX_GAP_S = 120;

/** Araç türüne göre makul hız aralığı (m/s). */
const SPEED_RANGE: Record<VehicleKind, [number, number]> = {
  subway: [4, 25],
  train: [6, 90],
  high_speed_train: [20, 100],
  tram: [2.5, 14],
  bus: [2.5, 22],
  ferry: [2, 18],
  cable_car: [0.8, 9],
  funicular: [0.8, 12],
  other: [1.5, 120],
};

export const plausibleSpeed = (vehicle: VehicleKind, ms: number) => ms >= SPEED_RANGE[vehicle][0] && ms <= SPEED_RANGE[vehicle][1];

/** Son konumların hızı (m/s): cihaz hızı varsa onun medyanı, yoksa ardışık konumların mesafe/süre oranı. */
export function effectiveSpeed(fixes: RideFix[]): number | null {
  const recent = fixes.slice(-3);
  const reported = recent.map((f) => f.speed).filter((s): s is number => s !== null && s >= 0);
  if (reported.length) {
    const sorted = [...reported].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
  }
  if (recent.length < 2) return null;
  const a = recent[recent.length - 2];
  const b = recent[recent.length - 1];
  const dt = (b.at - a.at) / 1000;
  if (dt <= 0 || dt > MAX_GAP_S) return null;
  return (distanceKm(a, b) * 1000) / dt;
}

function nearestStep(here: LatLng, steps: RideStep[], within: number): { step: RideStep; d: number } | null {
  let best: { step: RideStep; d: number } | null = null;
  for (const step of steps) {
    const d = distanceToPathM(here, step.path);
    if (d !== null && d <= within && (!best || d < best.d)) best = { step, d };
  }
  return best;
}

/**
 * Konum akışını bilinen toplu taşıma adımlarıyla eşleştirir. `steps` planlanan rota ve alternatifleri
 * içerebilir; böylece plandan farklı ama önerilen bir hatta binince de tanınır.
 */
export function matchRide(fixes: RideFix[], steps: RideStep[]): RideState {
  const last = fixes[fixes.length - 1];
  if (!last) return { kind: 'unknown' };
  const speed = effectiveSpeed(fixes);
  if (speed === null) return { kind: 'unknown' };

  if (speed >= RIDING_MIN_MS) {
    // Hıza uyan araç türlerini öne al: yürüyüş/bisiklet hızında metro eşleşmez, 30 m/s'de tramvay eşleşmez.
    const fits = steps.filter((s) => plausibleSpeed(s.vehicle, speed));
    const hit = nearestStep(last, fits, ON_PATH_M);
    if (!hit) return { kind: 'moving', speedMs: speed };
    const prev = fixes[fixes.length - 2];
    const prevHit = prev ? nearestStep(prev, fits, ON_PATH_M * 1.5) : null;
    return { kind: 'riding', step: hit.step, speedMs: speed, sure: prevHit?.step === hit.step };
  }

  if (speed <= STILL_MS) {
    // Durakta bekleme: bir adımın ilk noktasına yakın ve duruyor.
    let best: { step: RideStep; d: number } | null = null;
    for (const step of steps) {
      const start = step.path[0];
      if (!start) continue;
      const d = distanceKm(last, start) * 1000;
      if (d <= AT_STOP_M && (!best || d < best.d)) best = { step, d };
    }
    if (best) return { kind: 'waiting', step: best.step, speedMs: speed };
    return { kind: 'unknown' };
  }

  return { kind: 'walking', speedMs: speed };
}

/** Araçta kalan durak sayısı yaklaşık: çizgideki ilerlemeye göre. İniş noktasına kalan mesafe (m); çizgi boşsa null. */
export function metersToExit(here: LatLng, step: RideStep): number | null {
  const path = step.path;
  if (path.length < 2) return null;
  let nearest = 0;
  let nearestD = Infinity;
  path.forEach((p, i) => {
    const d = distanceKm(here, p);
    if (d < nearestD) {
      nearestD = d;
      nearest = i;
    }
  });
  let remaining = 0;
  for (let i = nearest; i < path.length - 1; i++) remaining += distanceKm(path[i], path[i + 1]) * 1000;
  return Math.round(remaining + nearestD * 1000);
}
