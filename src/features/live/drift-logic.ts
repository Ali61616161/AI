// Plana uyma takibinin saf mantığı (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).

export type DriftStop = { id: string; starts_at: string | null; ends_at: string | null; title: string };
export type StopMark = 'done' | 'skipped';

/** Saati geçtikten bu kadar dakika sonra durak "gecikmiş" sayılır ve kullanıcıya sorulur. */
export const GRACE_MIN = 25;
/** Bu süreden eski gecikmiş duraklar sorulmaz (gün çoktan ilerlemiştir). */
export const STALE_MIN = 6 * 60;

/**
 * Saati geçmiş, kullanıcının "gittim" ya da "atla" demediği en eski durak. Serbest gün işaretliyse
 * hiçbir şey sorulmaz.
 */
export function overdueStop<T extends DriftStop>(stops: T[], nowMs: number, marks: Record<string, StopMark>, freeDay: boolean): T | null {
  if (freeDay) return null;
  const overdue = stops
    .filter((s) => !marks[s.id] && s.starts_at)
    .map((s) => ({ s, start: Date.parse(s.starts_at!) }))
    .filter(({ start }) => Number.isFinite(start) && nowMs - start >= GRACE_MIN * 60_000 && nowMs - start <= STALE_MIN * 60_000)
    .sort((a, b) => a.start - b.start);
  return overdue[0]?.s ?? null;
}

/** Şu andan sonra başlayacak ilk işaretlenmemiş durak. */
export function nextStop<T extends DriftStop>(stops: T[], nowMs: number, marks: Record<string, StopMark>): T | null {
  return (
    stops
      .filter((s) => !marks[s.id] && s.starts_at && Date.parse(s.starts_at) > nowMs)
      .sort((a, b) => Date.parse(a.starts_at!) - Date.parse(b.starts_at!))[0] ?? null
  );
}

/** Yola şimdi çıkılırsa durağa kaç dakika geç kalınır (≤0: yetişir). */
export function minutesLate(nowMs: number, etaMin: number, startsAt: string): number {
  return Math.round((nowMs + etaMin * 60_000 - Date.parse(startsAt)) / 60_000);
}

/** Geç kalma bu kadar dakikayı geçince "plan kayıyor" uyarısı çıkar. */
export const LATE_WARN_MIN = 10;

/** Havalimanına en geç çıkış zamanı: kalkış − (tampon + yol süresi + pay). Dakika cinsinden yol süresi. */
export function leaveByMs(departMs: number, travelMin: number, bufferMin = 180, marginMin = 10): number {
  return departMs - (bufferMin + travelMin + marginMin) * 60_000;
}

/** Serbest gün anahtarı. */
export const freeDayKey = (tripId: string, date: string) => `${tripId}|${date}`;

/** Bir duraktan sonra hatırlatma bildirimi zamanı; geçmişse null. */
export function nudgeAt(startsAt: string | null, nowMs: number): Date | null {
  if (!startsAt) return null;
  const at = Date.parse(startsAt) + GRACE_MIN * 60_000;
  return Number.isFinite(at) && at > nowMs ? new Date(at) : null;
}
