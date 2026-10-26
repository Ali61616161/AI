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

// ---------------------------------------------------------------------------
// Anlık bildirim (push) metinleri: sunucu kullanıcının diline göre yazar (uygulama kapalıyken yerel çeviri yok).
// ---------------------------------------------------------------------------

type Lang = 'tr' | 'en' | 'es' | 'fr' | 'de' | 'it' | 'ru' | 'ar' | 'zh';
type Texts = { delayTitle: string; delayBody: string; cancelTitle: string; cancelBody: string };

const TEXTS: Record<Lang, Texts> = {
  tr: { delayTitle: 'Uçuşun gecikti', delayBody: '{number}: yeni kalkış {time} ({min} dk gecikme).', cancelTitle: 'Uçuşun iptal edildi', cancelBody: '{number} iptal edildi. Havayoluyla iletişime geç.' },
  en: { delayTitle: 'Your flight is delayed', delayBody: '{number}: new departure {time} ({min} min delay).', cancelTitle: 'Your flight was canceled', cancelBody: '{number} was canceled. Contact your airline.' },
  de: { delayTitle: 'Dein Flug hat Verspätung', delayBody: '{number}: neuer Abflug {time} ({min} Min. Verspätung).', cancelTitle: 'Dein Flug wurde annulliert', cancelBody: '{number} wurde annulliert. Wende dich an die Fluggesellschaft.' },
  es: { delayTitle: 'Tu vuelo se ha retrasado', delayBody: '{number}: nueva salida {time} ({min} min de retraso).', cancelTitle: 'Tu vuelo ha sido cancelado', cancelBody: '{number} ha sido cancelado. Contacta con tu aerolínea.' },
  fr: { delayTitle: 'Ton vol est retardé', delayBody: '{number} : nouveau départ {time} ({min} min de retard).', cancelTitle: 'Ton vol est annulé', cancelBody: '{number} est annulé. Contacte ta compagnie aérienne.' },
  it: { delayTitle: 'Il tuo volo è in ritardo', delayBody: '{number}: nuova partenza {time} ({min} min di ritardo).', cancelTitle: 'Il tuo volo è stato cancellato', cancelBody: '{number} è stato cancellato. Contatta la compagnia aerea.' },
  ru: { delayTitle: 'Твой рейс задерживается', delayBody: '{number}: новое время вылета {time} (задержка {min} мин).', cancelTitle: 'Твой рейс отменён', cancelBody: '{number} отменён. Свяжись с авиакомпанией.' },
  ar: { delayTitle: 'رحلتك متأخرة', delayBody: '{number}: موعد الإقلاع الجديد {time} (تأخير {min} دقيقة).', cancelTitle: 'تم إلغاء رحلتك', cancelBody: 'تم إلغاء {number}. تواصل مع شركة الطيران.' },
  zh: { delayTitle: '你的航班延误了', delayBody: '{number}：新起飞时间 {time}（延误 {min} 分钟）。', cancelTitle: '你的航班已取消', cancelBody: '{number} 已取消。请联系航空公司。' },
};

/** Bildirim başlığı ve metni (desteklenmeyen dil İngilizceye düşer). */
export function alertMessage(language: string, level: 'delay' | 'canceled', vars: { number: string; time: string; min: number }): { title: string; body: string } {
  const t = TEXTS[language as Lang] ?? TEXTS.en;
  const fill = (s: string) => s.replace('{number}', vars.number).replace('{time}', vars.time).replace('{min}', String(vars.min));
  return level === 'canceled' ? { title: t.cancelTitle, body: fill(t.cancelBody) } : { title: t.delayTitle, body: fill(t.delayBody) };
}

/** Gönderilmiş bildirimi tanıyan imza: aynı gecikme (10 dk dilimiyle), iptal ya da kapı değişmedikçe tekrar gönderilmez. */
export function alertKey(level: 'delay' | 'canceled', s: FlightStatus): string {
  return `${level}:${Math.round(s.departure.delay_min / 10)}:${s.departure.gate ?? ''}`;
}

/** Yerel saat (SS:DD) bir anın verilen saat diliminde. */
export function localTime(iso: string, timeZone: string | null, locale = 'en'): string {
  try {
    return new Intl.DateTimeFormat(locale, { timeZone: timeZone ?? 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
}
