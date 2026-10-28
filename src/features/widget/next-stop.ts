// Kilit ekranı / Dynamic Island "sıradaki durak" için saf mantık (arayüz bağımlılığı yok; testlenebilir).

export type StopItem = { status: string; starts_at: string | null; ends_at: string | null; timezone?: string | null; title: string; place_name: string | null };

export type NextStop = {
  /** Sıradaki (ya da şu an süren) durağın adı. */
  title: string;
  /** Başlangıç saati (yerel, "14:30"); saati yoksa boş. */
  time: string;
  /** Şu an bu durakta mı (başlamış, bitmemiş)? */
  now: boolean;
  /** Sıradakinden sonra kalan durak sayısı. */
  later: number;
  /** Etkinliğin ne zaman bayatlaması gerektiği (ms): durağın bitişi ya da başlangıcından sonra. */
  staleAtMs: number;
};

/** Canlı etkinlik yalnızca durağa bu kadar kala (ms) görünür; erken başlayıp ekranı doldurmasın. */
export const LEAD_MS = 3 * 60 * 60 * 1000;
/** Süresi belli olmayan durak başladıktan bu kadar sonra "geçti" sayılır (ms). */
export const DEFAULT_STOP_MS = 60 * 60 * 1000;

const endMs = (i: StopItem): number | null => (i.ends_at ? Date.parse(i.ends_at) : i.starts_at ? Date.parse(i.starts_at) + DEFAULT_STOP_MS : null);

/**
 * Bugünün planlanmış kalemlerinden sıradaki durağı seçer. Saatli ve bitmemiş ilk kalem; ona `LEAD_MS`'ten
 * fazla varsa ya da hiç kalem kalmadıysa null (etkinlik gösterilmez / bitirilir).
 */
export function pickNextStop(items: readonly StopItem[], nowMs: number, formatTime: (iso: string, tz: string | null) => string): NextStop | null {
  const upcoming = items
    .filter((i) => i.status === 'planned' && i.starts_at)
    .filter((i) => (endMs(i) ?? 0) > nowMs)
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  const next = upcoming[0];
  if (!next) return null;
  const start = Date.parse(next.starts_at!);
  if (start - nowMs > LEAD_MS) return null;
  return {
    title: next.place_name || next.title,
    time: formatTime(next.starts_at!, next.timezone ?? null),
    now: start <= nowMs,
    later: upcoming.length - 1,
    staleAtMs: endMs(next) ?? start,
  };
}
