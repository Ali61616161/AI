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
