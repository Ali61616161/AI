// Schengen 90/180 kuralı: herhangi bir gün için, o gün dahil geriye 180 günlük pencerede
// Schengen bölgesinde geçirilen gün sayısı 90'ı geçemez. Giriş ve çıkış günleri sayılır.
// Bilgi amaçlıdır; resmi hesap için AB'nin "short-stay calculator"ı esas alınır.

export type Stay = { entry_on: string; exit_on: string };

export const LIMIT = 90;
export const WINDOW = 180;
const DAY = 86_400_000;

const toDay = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / DAY);
const toIso = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);

/** `date` gününde biten 180 günlük pencerede Schengen'de geçirilen gün sayısı. */
export function daysUsed(stays: Stay[], date: string): number {
  const end = toDay(date);
  const start = end - WINDOW + 1;
  let total = 0;
  for (const s of stays) {
    const a = Math.max(toDay(s.entry_on), start);
    const b = Math.min(toDay(s.exit_on), end);
    if (b >= a) total += b - a + 1;
  }
  return total;
}

/** O gün itibarıyla kalan gün hakkı (eksiye düşmez). */
export function daysLeft(stays: Stay[], date: string): number {
  return Math.max(LIMIT - daysUsed(stays, date), 0);
}

/**
 * `entry` gününde girersen kuralı çiğnemeden en fazla kaç gün kalabilirsin ve son
 * çıkış günün. Hiç giremiyorsan 0 ve null.
 */
export function maxStayFrom(stays: Stay[], entry: string): { days: number; lastDay: string | null } {
  const start = toDay(entry);
  let days = 0;
  for (let d = start; d < start + LIMIT; d++) {
    const used = daysUsed(stays, toIso(d)) + (d - start + 1);
    if (used > LIMIT) break;
    days++;
  }
  return { days, lastDay: days ? toIso(start + days - 1) : null };
}

/** Geçmiş kalışlarda kuralın aşıldığı ilk gün (yoksa null). */
export function firstOverstay(stays: Stay[]): string | null {
  const days = stays.flatMap((s) => {
    const out: number[] = [];
    for (let d = toDay(s.entry_on); d <= toDay(s.exit_on); d++) out.push(d);
    return out;
  });
  for (const d of [...new Set(days)].sort((a, b) => a - b)) {
    if (daysUsed(stays, toIso(d)) > LIMIT) return toIso(d);
  }
  return null;
}

/** Hakkın yeniden açılmaya başladığı gün: pencereden düşen ilk kalış günü. */
export function nextDayFreed(stays: Stay[], date: string): string | null {
  const start = toDay(date) - WINDOW + 1;
  const firsts = stays
    .flatMap((s) => {
      const out: number[] = [];
      for (let d = Math.max(toDay(s.entry_on), start); d <= toDay(s.exit_on); d++) out.push(d);
      return out;
    })
    .filter((d) => d <= toDay(date));
  if (!firsts.length) return null;
  return toIso(Math.min(...firsts) + WINDOW);
}
