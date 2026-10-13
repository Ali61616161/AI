import { currentLanguage } from '@/i18n';

/** "1–6 Kas 2026" gibi, kullanıcının dilinde tarih aralığı. Tarihler YYYY-MM-DD. */
export function formatDateRange(start: string | null, end: string | null): string {
  if (!start) return '';
  const fmt = new Intl.DateTimeFormat(currentLanguage(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const s = new Date(`${start}T00:00:00Z`);
  const e = end ? new Date(`${end}T00:00:00Z`) : null;
  // formatRange tüm ortamlarda yoksa iki tarihi ayrı biçimlendir.
  const range = (fmt as Intl.DateTimeFormat & { formatRange?: (a: Date, b: Date) => string }).formatRange;
  if (e && range) return range.call(fmt, s, e);
  return e ? `${fmt.format(s)} – ${fmt.format(e)}` : fmt.format(s);
}

/** Rezervasyon saatini o yerin saat diliminde gösterir: "1 Kas, 09:45". */
export function formatLocalDateTime(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat(currentLanguage(), {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone ?? undefined,
  }).format(new Date(iso));
}

/** Bugünden itibaren kaç gün kaldığı (bugün = 0). Tarih YYYY-MM-DD. */
export function daysUntil(date: string, now = new Date()): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - today) / 86_400_000);
}

export function todayIsoDate(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Bugünden n gün önceki yerel tarih (YYYY-MM-DD). */
export function isoDateDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() - days);
  return todayIsoDate(d);
}

/** Saati o yerin saat diliminde gösterir: "09:45". */
export function formatTime(iso: string, timeZone: string | null): string {
  return new Intl.DateTimeFormat(currentLanguage(), {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timeZone ?? undefined,
  }).format(new Date(iso));
}

/** Kısa gün etiketi: "1 Kas Cmt". Tarih YYYY-MM-DD. */
export function formatDayShort(date: string): string {
  return new Intl.DateTimeFormat(currentLanguage(), { day: 'numeric', month: 'short', weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

/** Tutarı para birimiyle gösterir: "€20", "₺350". Para birimi geçersizse sayı + kod. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(currentLanguage(), { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

/** Yüzdeyi dile göre gösterir: "12.6%" (en), "%12,6" (tr), "12,6 %" (fr). */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat(currentLanguage(), { style: 'percent', maximumFractionDigits: 1 }).format(value / 100);
}
