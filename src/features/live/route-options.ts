// Konumdan odak durağa giden güzergah seçeneklerinin saf mantığı (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).

export type OptionStep = { mode: 'walk' | 'transit' | 'drive'; durationMin: number; transit: { departTime: string | null } | null };
export type OptionRoute = { durationMin: number; steps: OptionStep[] };

/** İlk toplu taşıma biniş saatine kalan dakika (negatif: kalkmış); toplu taşıma ya da saat yoksa null. */
export function departureInMin(route: OptionRoute, nowMs: number): number | null {
  const first = route.steps.find((s) => s.transit?.departTime);
  const at = first?.transit?.departTime ? Date.parse(first.transit.departTime) : NaN;
  return Number.isFinite(at) ? Math.round((at - nowMs) / 60_000) : null;
}

/** Aktarma sayısı: toplu taşıma adımı sayısı − 1 (en az 0). */
export function transferCount(route: OptionRoute): number {
  return Math.max(route.steps.filter((s) => s.transit).length - 1, 0);
}

/** Toplam yürüyüş süresi (dk). */
export function walkMinutes(route: OptionRoute): number {
  return route.steps.filter((s) => s.mode === 'walk').reduce((sum, s) => sum + s.durationMin, 0);
}

/**
 * Gösterilecek seçenekler: en çok `max`; kalkışı geçmiş seçenekler (toplu taşıma kaçmış) sona atılır, kalanlar süreye göre.
 */
export function pickOptions<T extends OptionRoute>(routes: readonly T[], nowMs: number, max = 3): T[] {
  const catchable = (r: T) => {
    const d = departureInMin(r, nowMs);
    return d === null || d >= 0;
  };
  const ok = routes.filter(catchable);
  const missed = routes.filter((r) => !catchable(r));
  return [...ok, ...missed].slice(0, max);
}

/** Seçili seçeneğin sırası: geçerliyse o, değilse ilk. */
export function clampOption(index: number | null | undefined, length: number): number {
  return index !== null && index !== undefined && Number.isInteger(index) && index >= 0 && index < length ? index : 0;
}
