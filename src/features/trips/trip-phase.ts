// Ana sayfanın seyahat aşaması (saf mantık; arayüz bağımlılığı yok, Deno testleri bunu içe aktarır).

/** Seyahate bu kadar gün ya da daha az kalınca "özet ekranı" gösterilir. */
export const SOON_DAYS = 15;

export type TripPhase = 'far' | 'soon' | 'active' | 'ended';

const dayNumber = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 86_400_000);

/**
 * far: seyahate 15 günden fazla var · soon: 15 gün ya da daha az · active: seyahat sürüyor
 * (başlangıç ve bitiş günü dahil) · ended: bitti. Tarihi olmayan seyahat "far" sayılır.
 */
export function tripPhase(start: string | null, end: string | null, today: string): TripPhase {
  if (!start) return 'far';
  const last = end ?? start;
  if (today > last) return 'ended';
  if (today >= start) return 'active';
  return dayNumber(start) - dayNumber(today) <= SOON_DAYS ? 'soon' : 'far';
}
