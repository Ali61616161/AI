// Seyahat bitince bir kez gösterilen "Nasıldı?" penceresinin seçim mantığı (saf fonksiyon; testlenebilir).

type TripLike = { id: string; end_date: string | null; status: string };

/** Bitişinden sonraki kaç gün içinde pencere gösterilir. */
export const PROMPT_WINDOW_DAYS = 30;

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Bitmiş (bitiş tarihi bugünden önce), son 30 gün içinde, raporu henüz tamamlanmamış ve pencere
 * daha önce gösterilmemiş en yeni seyahat. Yoksa null.
 */
export function pickEndedTrip<T extends TripLike>(trips: T[] | undefined, today: string, seen: readonly string[]): T | null {
  const earliest = addDays(today, -PROMPT_WINDOW_DAYS);
  const candidates = (trips ?? []).filter((t) => t.end_date && t.end_date < today && t.end_date >= earliest && t.status !== 'completed' && t.status !== 'cancelled' && !seen.includes(t.id));
  candidates.sort((a, b) => (b.end_date ?? '').localeCompare(a.end_date ?? ''));
  return candidates[0] ?? null;
}
