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

// ---------------------------------------------------------------------------
// Canlı akış: durak durumu, günün ilerlemesi, varış algılama, çıkış zamanı
// ---------------------------------------------------------------------------

export type StopMarkValue = 'done' | 'skipped';
/** Kartta ve haritada gösterilen durum. `later`: bugün ama henüz sırası gelmedi. */
export type StopStatus = 'done' | 'skipped' | 'now' | 'next' | 'past' | 'later';

const endOf = (s: LiveStop) => {
  const start = s.starts_at ? Date.parse(s.starts_at) : NaN;
  const end = s.ends_at ? Date.parse(s.ends_at) : NaN;
  return Number.isFinite(end) ? end : Number.isFinite(start) ? start + DEFAULT_STAY_MIN * 60_000 : NaN;
};

/** Bugünün duraklarının her biri için durum (işaret varsa o kazanır). */
export function stopStatuses(stops: LiveStop[], nowMs: number, marks: Record<string, StopMarkValue>): StopStatus[] {
  const cur = currentStop(stops, nowMs);
  return stops.map((s, i) => {
    if (marks[s.id]) return marks[s.id];
    if (cur && cur.index === i && cur.state !== 'done') return cur.state;
    const end = endOf(s);
    return Number.isFinite(end) && end <= nowMs ? 'past' : 'later';
  });
}

/** Günün ilerlemesi: işaretlenen ya da süresi geçen durak sayısı / toplam. */
export function dayProgress(statuses: StopStatus[]): { done: number; total: number; ratio: number } {
  const done = statuses.filter((s) => s === 'done' || s === 'skipped' || s === 'past').length;
  return { done, total: statuses.length, ratio: statuses.length ? done / statuses.length : 0 };
}

/** Varış yarıçapı (m) ve zaman penceresi: başlangıçtan 45 dk önce ile bitişten 60 dk sonrası. */
export const ARRIVE_RADIUS_M = 150;
const ARRIVE_BEFORE_MIN = 45;
const ARRIVE_AFTER_MIN = 60;

/** Konum, işaretlenmemiş ve saati yakın bir durağa yeterince yakınsa o durak ("vardın mı?"). */
export function arrivedStop<T extends LiveStop>(stops: T[], here: { lat: number; lng: number } | null, nowMs: number, marks: Record<string, StopMarkValue>): T | null {
  if (!here) return null;
  let best: { s: T; d: number } | null = null;
  for (const s of stops) {
    if (marks[s.id]) continue;
    const start = s.starts_at ? Date.parse(s.starts_at) : NaN;
    if (Number.isFinite(start)) {
      const end = endOf(s);
      if (nowMs < start - ARRIVE_BEFORE_MIN * 60_000 || nowMs > end + ARRIVE_AFTER_MIN * 60_000) continue;
    }
    const d = distanceKm(here, s) * 1000;
    if (d <= ARRIVE_RADIUS_M && (!best || d < best.d)) best = { s, d };
  }
  return best?.s ?? null;
}

/** Durağa zamanında varmak için kaç dakika içinde yola çıkılmalı (negatif: geç kaldın). Saat yoksa null. */
export function leaveInMin(nowMs: number, etaMin: number | null, startsAt: string | null): number | null {
  if (etaMin === null || !startsAt) return null;
  const start = Date.parse(startsAt);
  if (!Number.isFinite(start)) return null;
  return Math.round((start - etaMin * 60_000 - nowMs) / 60_000);
}

/**
 * Rota sorgusunun başlangıcı: konum bu kadar metreden az değiştiyse önceki nokta korunur (her
 * küçük harekette yeniden rota istenmez, kota korunur). Koordinatlar ~10 m'ye yuvarlanır.
 */
export function stableOrigin(prev: { lat: number; lng: number } | null, next: { lat: number; lng: number } | null, minMoveM = 300): { lat: number; lng: number } | null {
  if (!next) return prev;
  const rounded = { lat: Math.round(next.lat * 1e4) / 1e4, lng: Math.round(next.lng * 1e4) / 1e4 };
  if (prev && distanceKm(prev, rounded) * 1000 < minMoveM) return prev;
  return rounded;
}

/** Yürüyerek gidilecek kadar yakınsa (kuş uçuşu) yürüyüş modu seçilir. */
export const WALK_MODE_KM = 1.2;
