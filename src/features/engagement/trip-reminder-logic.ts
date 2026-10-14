// Seyahat öncesi hatırlatmaların zamanları (saf fonksiyon). Yerel saatle: başlangıçtan
// bir gün önce 18:00 (hazırlık) ve başlangıç günü 08:00 (iyi yolculuklar).

export type ReminderTrip = { id: string; start_date: string | null; status?: string | null; city: string | null };
export type TripReminder = { tripId: string; kind: 'day_before' | 'start_day'; date: Date; city: string | null };

export function tripReminderDates(trips: ReminderTrip[], now: number, limit = 20): TripReminder[] {
  const out: TripReminder[] = [];
  for (const t of trips) {
    if (!t.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(t.start_date) || t.status === 'cancelled') continue;
    const [y, m, d] = t.start_date.split('-').map(Number);
    const dayBefore = new Date(y, m - 1, d - 1, 18, 0, 0);
    const startDay = new Date(y, m - 1, d, 8, 0, 0);
    if (dayBefore.getTime() > now) out.push({ tripId: t.id, kind: 'day_before', date: dayBefore, city: t.city });
    if (startDay.getTime() > now) out.push({ tripId: t.id, kind: 'start_day', date: startDay, city: t.city });
  }
  // iOS en fazla 64 bekleyen bildirim tutar; belge hatırlatmalarına da yer kalsın.
  return out.sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, limit);
}
