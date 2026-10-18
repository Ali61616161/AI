// Canlı görünümün saf mantığı (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).

export type LiveStop = {
  id: string;
  lat: number;
  lng: number;
  starts_at: string | null;
  ends_at: string | null;
};

/** İki koordinat arası kuş uçuşu mesafe (km). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Yürüyüş hızı ~4.8 km/sa; yol eğriliği için kuş uçuşuna %25 eklenir. */
export const WALK_KMH = 4.8;
export const DETOUR = 1.25;
/** Bu mesafeden uzak duraklar için yürüme süresi söylenmez (başka bir ulaşım gerekir). */
export const MAX_WALK_KM = 2.5;

export type Hop = { km: number; walkMin: number | null };

/** Önceki duraktan bu durağa tahmini mesafe ve yürüme süresi (gerçek tarifi Rota ekranı verir). */
export function hopBetween(prev: { lat: number; lng: number }, cur: { lat: number; lng: number }): Hop {
  const km = distanceKm(prev, cur) * DETOUR;
  return { km: Math.round(km * 10) / 10, walkMin: km <= MAX_WALK_KM ? Math.max(1, Math.round((km / WALK_KMH) * 60)) : null };
}

export type StopState = 'now' | 'next' | 'done';

/** Süresi belirsiz kalemler için varsayılan kalış süresi. */
const DEFAULT_STAY_MIN = 60;

/**
 * Şu anki durumu bulur: şu an süren durak ("now"), yoksa sıradaki ("next"), gün bittiyse
 * son durak ("done"). Hiçbir durakta saat yoksa null.
 */
export function currentStop(stops: LiveStop[], nowMs: number): { index: number; state: StopState } | null {
  const timed = stops.map((s, index) => ({ index, start: s.starts_at ? Date.parse(s.starts_at) : NaN, end: s.ends_at ? Date.parse(s.ends_at) : NaN })).filter((s) => Number.isFinite(s.start));
  if (!timed.length) return null;
  const running = timed.find((s) => nowMs >= s.start && nowMs < (Number.isFinite(s.end) ? s.end : s.start + DEFAULT_STAY_MIN * 60_000));
  if (running) return { index: running.index, state: 'now' };
  const upcoming = timed.filter((s) => s.start > nowMs).sort((a, b) => a.start - b.start)[0];
  if (upcoming) return { index: upcoming.index, state: 'next' };
  return { index: timed[timed.length - 1].index, state: 'done' };
}

/** Takvim gününe (YYYY-MM-DD) göre gün sırası; bugün yoksa null. */
export function dayIndexFor(dates: string[], today: string): number | null {
  const i = dates.indexOf(today);
  return i >= 0 ? i : null;
}
