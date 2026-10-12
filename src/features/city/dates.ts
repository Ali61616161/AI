/** Gelecek hafta sonu (Cumartesi başlar) için başlangıç ve bitiş tarihi (YYYY-AA-GG). */
export function nextWeekendDates(days: number, today = new Date()): { start: string; end: string } {
  const d = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const toSaturday = (6 - d.getUTCDay() + 7) % 7 || 7;
  // Bugün Cuma veya Cumartesi ise bu hafta sonu; yoksa bir sonraki Cumartesi.
  const offset = d.getUTCDay() === 5 ? 1 : d.getUTCDay() === 6 ? 0 : toSaturday;
  const start = new Date(d.getTime() + offset * 86_400_000);
  const end = new Date(start.getTime() + (Math.max(days, 1) - 1) * 86_400_000);
  const iso = (x: Date) => x.toISOString().slice(0, 10);
  return { start: iso(start), end: iso(end) };
}
