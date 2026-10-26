// Uçuş durumu (AeroDataBox): saf mantık. Ağ ve veritabanı çağrıları flight-status/index.ts'te.

export type FlightState = 'scheduled' | 'delayed' | 'boarding' | 'departed' | 'arrived' | 'canceled' | 'diverted' | 'unknown';

export type FlightStatus = {
  state: FlightState;
  departure: { scheduled_utc: string | null; revised_utc: string | null; delay_min: number; terminal: string | null; gate: string | null };
  arrival: { scheduled_utc: string | null; revised_utc: string | null; delay_min: number; terminal: string | null; gate: string | null; baggage_belt: string | null };
};

/** "TK 1865", "tk-1865" → "TK1865"; uçuş numarası biçiminde değilse null. */
export function normalizeFlightNumber(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const n = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^[A-Z0-9]{2}\d{1,4}[A-Z]?$/.test(n) ? n : null;
}

/** Bir anın verilen saat dilimindeki yerel tarihi (YYYY-MM-DD). Saat dilimi geçersizse UTC. */
export function localDate(iso: string, timeZone: string | null): string {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Önbellek ömrü (dakika): kalkışa ne kadar kaldığına göre. Uzak uçuşlar sorgulanmaz (null) ki ücretsiz kota
 * yalnızca yaklaşan uçuşlara harcansın.
 */
export function cacheTtlMin(minutesToDeparture: number, minutesSinceArrival = -Infinity): number | null {
  if (minutesSinceArrival > 60) return null;
  if (minutesToDeparture > 24 * 60) return null;
  if (minutesToDeparture > 6 * 60) return 180;
  if (minutesToDeparture > 2 * 60) return 45;
  if (minutesToDeparture > 0) return 15;
  return 30;
}

const STATE: Record<string, FlightState> = {
  Expected: 'scheduled',
  CheckIn: 'scheduled',
  Boarding: 'boarding',
  GateClosed: 'boarding',
  Departed: 'departed',
  EnRoute: 'departed',
  Approaching: 'departed',
  Arrived: 'arrived',
  Delayed: 'delayed',
  Canceled: 'canceled',
  CanceledUncertain: 'canceled',
  Diverted: 'diverted',
};

// "2026-10-26 15:30Z" → ISO (AeroDataBox boşlukla ayırır).
function utc(t: unknown): string | null {
  const s = (t as { utc?: unknown } | null | undefined)?.utc;
  if (typeof s !== 'string') return null;
  const ms = Date.parse(s.replace(' ', 'T'));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 20) : null);

function leg(l: Record<string, unknown> | undefined) {
  const scheduled = utc(l?.scheduledTime);
  const revised = utc(l?.revisedTime) ?? utc(l?.predictedTime);
  const delay = scheduled && revised ? Math.round((Date.parse(revised) - Date.parse(scheduled)) / 60_000) : 0;
  return { scheduled_utc: scheduled, revised_utc: revised, delay_min: delay, terminal: text(l?.terminal), gate: text(l?.gate) };
}

/**
 * AeroDataBox "uçuş numarası + tarih" yanıtından bizim uçuşu seçer (aynı numara birden çok bacak olabilir:
 * kalkış havalimanı eşleşen alınır) ve sadeleştirir.
 */
export function parseFlights(data: unknown, originCode: string | null): FlightStatus | null {
  if (!Array.isArray(data) || data.length === 0) return null;
  const flights = data as Record<string, unknown>[];
  const origin = originCode?.toUpperCase() ?? null;
  const match =
    (origin && flights.find((f) => String(((f.departure as { airport?: { iata?: string } } | undefined)?.airport?.iata) ?? '').toUpperCase() === origin)) || flights[0];
  const dep = leg(match.departure as Record<string, unknown> | undefined);
  const arr = leg(match.arrival as Record<string, unknown> | undefined);
  const arrival = match.arrival as Record<string, unknown> | undefined;
  let state = STATE[String(match.status)] ?? 'unknown';
  if (state === 'scheduled' && dep.delay_min >= 15) state = 'delayed';
  return { state, departure: dep, arrival: { ...arr, baggage_belt: text(arrival?.baggageBelt) } };
}

export type AlertLevel = 'none' | 'delay' | 'canceled';

/** Kullanıcıya bildirim gerektiren durum: iptal ya da en az 15 dakikalık kalkış gecikmesi. */
export function alertLevel(s: FlightStatus): AlertLevel {
  if (s.state === 'canceled') return 'canceled';
  if (s.departure.delay_min >= 15 && s.state !== 'arrived') return 'delay';
  return 'none';
}
