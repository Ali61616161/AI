// Tarih/saat seçicilerinin metin <-> Date dönüşümleri (saf; testlenebilir).

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const CLOCK = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "2026-11-12" → yerel öğlen 12:00 (saat dilimi kaymasında günün değişmemesi için); geçersizse null. */
export function parseIsoDate(value: string): Date | null {
  const m = ISO.exec(value.trim());
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d ? date : null;
}

/** Yerel takvim gününü "YYYY-AA-GG" yapar. */
export function formatIsoDate(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** "14:30" → bugünün o saati; geçersizse null. */
export function parseClock(value: string): Date | null {
  const m = CLOCK.exec(value.trim());
  if (!m) return null;
  const date = new Date();
  date.setHours(Number(m[1]), Number(m[2]), 0, 0);
  return date;
}

export function formatClock(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(date.getHours())}:${p(date.getMinutes())}`;
}

/** Seçilebilecek en erken/en geç günü sınırlar; sınır dışıysa en yakın sınıra çeker. */
export function clampIsoDate(value: string, min?: string | null, max?: string | null): string {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}
