// Jet lag planı: kalkış ve varış saat dilimleri arasındaki fark ve yöne göre
// uyku saatini kademeli kaydırma ve ışık önerisi.

/** Belirli bir anda iki saat dilimi arasındaki fark (saat; doğu yönü pozitif). */
export function offsetHours(fromTz: string, toTz: string, at: Date = new Date()): number {
  const local = (tz: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(at);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  };
  return Math.round(((local(toTz) - local(fromTz)) / 3_600_000) * 2) / 2;
}

export type JetLagPlan = {
  hours: number;
  direction: 'east' | 'west' | 'none';
  /** Uyum için tahmini gün (doğuya yaklaşık saat başına 1 gün, batıya 1,5 saatte 1 gün). */
  recoveryDays: number;
  /** Kalkıştan önceki günlerde her gün yatma saatinin kaç saat kaydırılacağı (negatif = erken). */
  shiftPerDay: number;
  daysBefore: number;
  severity: 'none' | 'mild' | 'moderate' | 'strong';
};

export function jetLagPlan(fromTz: string, toTz: string, at: Date = new Date()): JetLagPlan {
  let hours = offsetHours(fromTz, toTz, at);
  // 12 saati aşan farkta kısa yol (ör. +14 yerine -10) daha kolay uyum demektir.
  if (hours > 12) hours -= 24;
  if (hours < -12) hours += 24;
  const abs = Math.abs(hours);
  const direction = abs < 1 ? 'none' : hours > 0 ? 'east' : 'west';
  const recoveryDays = direction === 'none' ? 0 : Math.ceil(direction === 'east' ? abs : abs / 1.5);
  const daysBefore = abs >= 3 ? Math.min(3, Math.floor(abs / 2)) : 0;
  return {
    hours,
    direction,
    recoveryDays,
    shiftPerDay: daysBefore ? (direction === 'east' ? -1 : 1) : 0,
    daysBefore,
    severity: abs < 1 ? 'none' : abs < 3 ? 'mild' : abs < 7 ? 'moderate' : 'strong',
  };
}
