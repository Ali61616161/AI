// Kilit ekranı / Dynamic Island "sıradaki durak" için saf mantık (arayüz bağımlılığı yok; testlenebilir).

export type StopItem = { id?: string; status: string; starts_at: string | null; ends_at: string | null; timezone?: string | null; title: string; place_name: string | null };

export type NextStop = {
  /** Durağın plan kalemi kimliği (verilmişse). */
  id: string | null;
  /** Sıradaki (ya da şu an süren) durağın adı. */
  title: string;
  /** Başlangıç saati (yerel, "14:30"); saati yoksa boş. */
  time: string;
  /** Şu an bu durakta mı (başlamış ya da "buradayım" denmiş, bitmemiş)? */
  now: boolean;
  /** Sıradakinden sonra kalan durak sayısı. */
  later: number;
  /** Geri sayımın hedefi (ms): şu an durakta isen bitişi, değilse başlangıcı. Sistem bunu kendisi sayar. */
  targetMs: number;
  /** Etkinliğin ne zaman bayatlaması gerektiği (ms): durağın bitişi ya da başlangıcından sonra. */
  staleAtMs: number;
};

/** Canlı etkinlik yalnızca durağa bu kadar kala (ms) görünür; erken başlayıp ekranı doldurmasın. */
export const LEAD_MS = 3 * 60 * 60 * 1000;
/** Süresi belli olmayan durak başladıktan bu kadar sonra "geçti" sayılır (ms). */
export const DEFAULT_STOP_MS = 60 * 60 * 1000;

const endMs = (i: StopItem): number | null => (i.ends_at ? Date.parse(i.ends_at) : i.starts_at ? Date.parse(i.starts_at) + DEFAULT_STOP_MS : null);

/** Uygulamada "gittim / atla" (işaret) ya da "buradayım" (ara adım) denen duraklar. */
export type StopFlags = { marks?: Record<string, string>; steps?: Record<string, string> };

/**
 * Bugünün planlanmış kalemlerinden sıradaki durağı seçer. Saatli ve bitmemiş ilk kalem; gittim/atla denenler
 * sayılmaz, "buradayım" denen durak saati geçse de süren sayılır. Ona `LEAD_MS`'ten fazla varsa ya da hiç
 * kalem kalmadıysa null (etkinlik gösterilmez / bitirilir).
 */
export function pickNextStop(items: readonly StopItem[], nowMs: number, formatTime: (iso: string, tz: string | null) => string, flags: StopFlags = {}): NextStop | null {
  const marks = flags.marks ?? {};
  const steps = flags.steps ?? {};
  const upcoming = items
    .filter((i) => i.status === 'planned' && i.starts_at && !(i.id && marks[i.id]))
    .filter((i) => (i.id && steps[i.id] === 'here') || (endMs(i) ?? 0) > nowMs)
    .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!));
  // "Buradayım" ya da "yoldayım" denen durak, saatine bakılmaksızın önce gelir.
  const stepped = upcoming.find((i) => i.id && steps[i.id] === 'here') ?? upcoming.find((i) => i.id && steps[i.id] === 'enroute');
  const next = stepped ?? upcoming[0];
  if (!next) return null;
  const start = Date.parse(next.starts_at!);
  const here = Boolean(next.id && steps[next.id] === 'here');
  if (!stepped && start - nowMs > LEAD_MS) return null;
  const now = here || start <= nowMs;
  const end = endMs(next) ?? start;
  return {
    id: next.id ?? null,
    title: next.place_name || next.title,
    time: formatTime(next.starts_at!, next.timezone ?? null),
    now,
    later: upcoming.length - 1,
    targetMs: now ? Math.max(end, nowMs) : start,
    staleAtMs: Math.max(end, start),
  };
}
