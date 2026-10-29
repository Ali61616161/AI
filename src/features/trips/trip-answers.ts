// Seyahat kurulurken sorulan cevapların saf mantığı (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).
import { localToUtcIso } from '../../../supabase/functions/_shared/documents.ts';
import { normalizeFlightNumber, type FlightInfo } from '../../../supabase/functions/_shared/flight-status.ts';

export type Companion = 'solo' | 'couple' | 'family' | 'friends';
export type BudgetChoice = 'low' | 'mid' | 'lux' | 'custom';
export type LocalTransport = 'transit' | 'car' | 'mixed';
/** Gidilen yere ulaşım türü; 'undecided' = henüz karar verilmedi. */
export type TravelMode = 'flight' | 'car' | 'train' | 'bus' | 'ferry' | 'undecided';
export const TRAVEL_MODES: readonly TravelMode[] = ['flight', 'car', 'train', 'bus', 'ferry', 'undecided'];
export type BudgetTier = 'low' | 'mid' | 'lux';

export const NOTES_MAX = 1000;
export const MAX_HOTELS = 3;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type HotelInput = { name: string; address: string; checkIn: string; checkOut: string };

export type TripAnswers = {
  companion: Companion;
  budget: BudgetChoice;
  /** "Diğer" bütçe seçildiğinde kişi başı günlük tutar (metin; "1.250,50" gibi biçimler kabul edilir). */
  dailyBudget: string;
  currency: string;
  interests: string[];
  transport: LocalTransport;
  /** Gidilen yere nasıl ulaşılacak (birden fazla olabilir). */
  travelModes: TravelMode[];
  /** Gidiş ve dönüş uçuş numaraları (isteğe bağlı); doluysa havalimanları ve saatler otomatik bulunur. */
  outboundFlight: string;
  returnFlight: string;
  notes: string;
  hotels: HotelInput[];
  /** Gidilen ülkeye iniş / dönüş uçuşu kalkış saati (yerel, HH:MM) ve havalimanları; hepsi isteğe bağlı. */
  arrivalTime: string;
  arrivalAirport: string;
  departureTime: string;
  departureAirport: string;
};

export const emptyHotel = (): HotelInput => ({ name: '', address: '', checkIn: '', checkOut: '' });

/** "120", "1.250,50", "1,250.50", "₺ 900" → sayı; geçersiz veya ≤0 ise null. */
export function parseAmount(text: string): number | null {
  const cleaned = text.replace(/[^\d.,]/g, '');
  if (!cleaned) return null;
  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    normalized = cleaned.split(decimalSep === '.' ? ',' : '.').join('').replace(decimalSep, '.');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = cleaned.split(sep);
    // Tek ayırıcı ve sonrasında tam 3 hane: binlik ayırıcı ("1.250"); aksi halde ondalık.
    normalized = parts.length === 2 && parts[1].length !== 3 ? `${parts[0]}.${parts[1]}` : parts.join('');
  } else {
    normalized = cleaned;
  }
  const value = Number(normalized);
  return Number.isFinite(value) && value > 0 && value <= 1_000_000 ? Math.round(value * 100) / 100 : null;
}

export function isCurrencyCode(value: string): boolean {
  return /^[A-Za-z]{3}$/.test(value.trim());
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** "930", "9.30", "9:30" → "09:30"; geçersizse null. Boş metin de null (alan boş bırakıldı). */
export function parseClock(text: string): string | null {
  const digits = text.trim().replace(/[.\s]/g, ':');
  const m = /^(\d{1,2}):?(\d{2})$/.exec(digits);
  if (!m) return null;
  const value = `${m[1].padStart(2, '0')}:${m[2]}`;
  return TIME.test(value) ? value : null;
}

export function isBlankOrClock(text: string): boolean {
  return !text.trim() || parseClock(text) !== null;
}

export type HotelIssue = 'name' | 'dates' | null;

/** Boş ad = satır yok sayılır (null). Geçersiz tarih veya ters sıra hata verir; boş tarih seyahat tarihlerine düşer. */
export function hotelIssue(h: HotelInput): HotelIssue | 'empty' {
  if (!h.name.trim() && !h.address.trim() && !h.checkIn.trim() && !h.checkOut.trim()) return 'empty';
  if (!h.name.trim()) return 'name';
  const inn = h.checkIn.trim();
  const out = h.checkOut.trim();
  if ((inn && !DATE.test(inn)) || (out && !DATE.test(out))) return 'dates';
  if (inn && out && out < inn) return 'dates';
  return null;
}

/**
 * Ulaşım seçimi: "karar vermedim" diğerleriyle birlikte tutulmaz (seçilince diğerleri kalkar, bir tür seçilince o kalkar).
 */
export function toggleTravelMode(current: readonly TravelMode[], mode: TravelMode): TravelMode[] {
  if (mode === 'undecided') return current.includes('undecided') ? [] : ['undecided'];
  const rest = current.filter((m) => m !== 'undecided');
  return rest.includes(mode) ? rest.filter((m) => m !== mode) : [...rest, mode];
}

/** Uçuş saati/havalimanı soruları yalnızca uçakla gidiliyorsa (ya da hiçbir şey seçilmediyse) anlamlıdır. */
export const asksFlightTimes = (modes: readonly TravelMode[]): boolean => modes.length === 0 || modes.includes('flight');

export type NormalizedAnswers = {
  budgetTier: BudgetTier;
  /** Kişi başı günlük tutar ve para birimi; yalnızca "Diğer" bütçe seçilip geçerli tutar girildiyse. */
  budgetAmount: { amount: number; currency: string } | null;
  notes: string | null;
  hotels: HotelInput[];
  /** İlk hatalı otel satırının sırası ve nedeni; yoksa null. */
  hotelError: { index: number; issue: Exclude<HotelIssue, null> } | null;
  budgetError: boolean;
  travelModes: TravelMode[];
  flights: { out: string | null; back: string | null };
  /** Dolu ama uçuş numarası biçiminde olmayan alan. */
  flightError: boolean;
  arrivalTime: string | null;
  departureTime: string | null;
  arrivalAirport: string | null;
  departureAirport: string | null;
  /** Dolu ama geçersiz saat alanı. */
  timeError: boolean;
};

export function normalizeAnswers(a: TripAnswers): NormalizedAnswers {
  const custom = a.budget === 'custom';
  const amount = custom ? parseAmount(a.dailyBudget) : null;
  const hotels: HotelInput[] = [];
  let hotelError: NormalizedAnswers['hotelError'] = null;
  a.hotels.forEach((h, index) => {
    const issue = hotelIssue(h);
    if (issue === 'empty') return;
    if (issue) hotelError ??= { index, issue };
    else hotels.push(h);
  });
  return {
    budgetTier: a.budget === 'low' || a.budget === 'lux' ? a.budget : 'mid',
    budgetAmount: amount !== null && isCurrencyCode(a.currency) ? { amount, currency: a.currency.trim().toUpperCase() } : null,
    notes: a.notes.replace(/\s+$/g, '').trim().slice(0, NOTES_MAX) || null,
    hotels,
    hotelError,
    budgetError: custom && (amount === null || !isCurrencyCode(a.currency)),
    travelModes: TRAVEL_MODES.filter((m) => a.travelModes.includes(m)),
    flights: { out: normalizeFlightNumber(a.outboundFlight), back: normalizeFlightNumber(a.returnFlight) },
    flightError: (a.outboundFlight.trim() !== '' && !normalizeFlightNumber(a.outboundFlight)) || (a.returnFlight.trim() !== '' && !normalizeFlightNumber(a.returnFlight)),
    arrivalTime: parseClock(a.arrivalTime),
    departureTime: parseClock(a.departureTime),
    arrivalAirport: a.arrivalAirport.trim().slice(0, 120) || null,
    departureAirport: a.departureAirport.trim().slice(0, 120) || null,
    timeError: !isBlankOrClock(a.arrivalTime) || !isBlankOrClock(a.departureTime),
  };
}

/** Otel girişi: seyahat tarihleri varsayılandır; giriş 15:00, çıkış 11:00 (saat dilimi bilinmediği için UTC kabul edilir). */
export function hotelReservationRow(h: HotelInput, tripId: string, trip: { start: string | null; end: string | null }) {
  const checkIn = h.checkIn.trim() || trip.start || null;
  const checkOut = h.checkOut.trim() || trip.end || checkIn;
  if (!checkIn || !checkOut) return null;
  return {
    trip_id: tripId,
    type: 'hotel' as const,
    title: h.name.trim().slice(0, 200),
    address: h.address.trim().slice(0, 300) || null,
    starts_at: localToUtcIso(`${checkIn}T15:00`, null),
    ends_at: localToUtcIso(`${checkOut > checkIn ? checkOut : checkIn}T11:00`, null),
  };
}

/** Bulunan uçuştan rezervasyon satırı (canlı takip ve plan bunu kullanır). */
export function flightReservationRow(info: FlightInfo, tripId: string) {
  return {
    trip_id: tripId,
    type: 'flight' as const,
    title: `${info.number} ${info.origin.code} → ${info.destination.code}`,
    provider_name: info.airline,
    starts_at: info.departs_utc,
    ends_at: info.arrives_utc && info.arrives_utc >= info.departs_utc ? info.arrives_utc : null,
    start_timezone: info.origin.timezone,
    end_timezone: info.destination.timezone,
    origin_code: info.origin.code,
    origin_name: info.origin.name,
    destination_code: info.destination.code,
    destination_name: info.destination.name,
    details: { flight_number: info.number },
  };
}
