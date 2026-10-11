// Bilet ve rezervasyon belgelerinden çıkarılan verinin ortak tanımı.
// Hem Edge Function (Deno) hem uygulama (React Native) bu dosyayı kullanır; bu
// yüzden hiçbir dış paket import etmez.

export const RESERVATION_TYPES = ['flight', 'hotel', 'train', 'bus', 'car_rental', 'event', 'other'] as const;
export type ReservationType = (typeof RESERVATION_TYPES)[number];

/** Bu değerin altındaki alanlar arayüzde "kontrol et" uyarısıyla gösterilir. */
export const LOW_CONFIDENCE = 0.7;

/** Bir yolculuğun veya konaklamanın başlangıç ya da bitiş noktası. */
export type Endpoint = {
  /** Belgede yazan yerel saat: YYYY-MM-DDTHH:mm (saat yoksa T00:00). */
  local_datetime: string | null;
  /** IANA saat dilimi, ör. Europe/Rome. */
  timezone: string | null;
  /** Havalimanı, istasyon veya otel adı. */
  place_name: string | null;
  /** IATA havalimanı kodu veya istasyon kodu. */
  code: string | null;
  city: string | null;
  /** ISO 3166-1 alpha-2. */
  country_code: string | null;
  address: string | null;
};

export type ParsedItem = {
  type: ReservationType;
  title: string;
  provider_name: string | null;
  /** PNR, onay numarası vb. */
  reference_code: string | null;
  start: Endpoint;
  end: Endpoint | null;
  /** Türe özel alanlar: uçuş no, koltuk, bagaj, kahvaltı dahil mi, peron... */
  details: Record<string, string | number | boolean | string[]>;
  /** Alan adı → 0..1 güven skoru (ör. "start.local_datetime": 0.95). */
  confidence: Record<string, number>;
};

export type ParsedDocument = {
  document_type: ReservationType;
  items: ParsedItem[];
  passenger_names: string[];
};

const ENDPOINT_SCHEMA = {
  type: 'OBJECT',
  nullable: true,
  properties: {
    local_datetime: { type: 'STRING', nullable: true, description: 'Local date and time printed on the document, format YYYY-MM-DDTHH:mm' },
    timezone: { type: 'STRING', nullable: true, description: 'IANA time zone of this place, e.g. Europe/Istanbul' },
    place_name: { type: 'STRING', nullable: true, description: 'Airport, station, venue or hotel name' },
    code: { type: 'STRING', nullable: true, description: 'IATA airport code or station code if printed' },
    city: { type: 'STRING', nullable: true, description: 'City name in English' },
    country_code: { type: 'STRING', nullable: true, description: 'ISO 3166-1 alpha-2 country code' },
    address: { type: 'STRING', nullable: true },
  },
};

/**
 * Gemini "responseSchema" biçiminde (OpenAPI alt kümesi) çıktı şeması. Modelin
 * serbest metin yerine bu yapıda JSON döndürmesini zorunlu kılar.
 */
export const EXTRACTION_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    document_type: { type: 'STRING', enum: [...RESERVATION_TYPES] },
    passenger_names: { type: 'ARRAY', items: { type: 'STRING' } },
    items: {
      type: 'ARRAY',
      description: 'One entry per flight segment, hotel stay, train ride, rental or event ticket',
      items: {
        type: 'OBJECT',
        properties: {
          type: { type: 'STRING', enum: [...RESERVATION_TYPES] },
          title: { type: 'STRING', description: 'Short human title, e.g. "TK1863 Istanbul → Rome" or hotel name' },
          provider_name: { type: 'STRING', nullable: true, description: 'Airline, hotel, rail company, platform' },
          reference_code: { type: 'STRING', nullable: true, description: 'Booking reference / PNR / confirmation number' },
          start: ENDPOINT_SCHEMA,
          end: ENDPOINT_SCHEMA,
          details: {
            type: 'OBJECT',
            nullable: true,
            properties: {
              flight_number: { type: 'STRING', nullable: true },
              seat: { type: 'STRING', nullable: true },
              cabin: { type: 'STRING', nullable: true },
              baggage: { type: 'STRING', nullable: true },
              terminal: { type: 'STRING', nullable: true },
              gate: { type: 'STRING', nullable: true },
              train_number: { type: 'STRING', nullable: true },
              coach: { type: 'STRING', nullable: true },
              platform: { type: 'STRING', nullable: true },
              room_type: { type: 'STRING', nullable: true },
              guests: { type: 'INTEGER', nullable: true },
              breakfast_included: { type: 'BOOLEAN', nullable: true },
              total_price: { type: 'NUMBER', nullable: true },
              currency: { type: 'STRING', nullable: true },
            },
          },
          confidence: {
            type: 'OBJECT',
            description: 'Confidence 0..1 for the key fields you extracted',
            properties: {
              title: { type: 'NUMBER' },
              reference_code: { type: 'NUMBER' },
              start_datetime: { type: 'NUMBER' },
              end_datetime: { type: 'NUMBER' },
              start_place: { type: 'NUMBER' },
              end_place: { type: 'NUMBER' },
            },
          },
        },
        required: ['type', 'title', 'start'],
      },
    },
  },
  required: ['document_type', 'items'],
};

export const EXTRACTION_PROMPT = `You read travel documents: flight tickets, boarding passes, e-tickets, hotel or apartment bookings, train and bus tickets, car rentals and event tickets. The document may be in any language.

Extract every reservation in it as structured data:
- One item per flight segment (a connecting flight is two items), per hotel stay, per train or bus ride, per rental, per event ticket.
- Copy dates and times exactly as printed and give them as local time at that place (YYYY-MM-DDTHH:mm). If only a date is printed use T00:00 and lower the confidence. Hotel check-in/out times go in start/end.
- Add the IANA time zone of each place from your knowledge of the airport or city.
- For hotels, start is check-in at the hotel and end is check-out at the same hotel.
- Write city names in English and country codes as ISO 3166-1 alpha-2.
- Never invent data that is not on the document. Use null when something is missing and give low confidence when you are unsure (blurry, cut off, ambiguous).
- If the document is not a travel reservation, return document_type "other" and an empty items array.`;

// ---------------------------------------------------------------------------
// Doğrulama ve temizleme: model çıktısına güvenmeden önce tip ve biçim kontrolü.
// ---------------------------------------------------------------------------

const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

function str(value: unknown, max = 200): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function upperCode(value: unknown, length?: number): string | null {
  const s = str(value, 10)?.toUpperCase().replace(/[^A-Z0-9]/g, '') ?? null;
  if (!s) return null;
  if (length && s.length !== length) return null;
  return s;
}

export function normalizeLocalDateTime(value: unknown): string | null {
  const s = str(value, 40);
  const m = s ? LOCAL_DATETIME.exec(s) : null;
  if (!m) return null;
  const [, y, mo, d, h = '00', mi = '00'] = m;
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12 || day < 1 || day > 31 || Number(h) > 23 || Number(mi) > 59) return null;
  return `${y}-${mo}-${d}T${h}:${mi}`;
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function endpoint(value: unknown): Endpoint | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const timezone = str(v.timezone, 64);
  const result: Endpoint = {
    local_datetime: normalizeLocalDateTime(v.local_datetime),
    timezone: timezone && isValidTimeZone(timezone) ? timezone : null,
    place_name: str(v.place_name),
    code: upperCode(v.code),
    city: str(v.city, 100),
    country_code: upperCode(v.country_code, 2),
    address: str(v.address, 300),
  };
  const empty = Object.values(result).every((x) => x === null);
  return empty ? null : result;
}

function details(value: unknown): ParsedItem['details'] {
  const out: ParsedItem['details'] = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[a-z_]{1,40}$/.test(key) || raw === null || raw === undefined) continue;
    if (typeof raw === 'string') {
      const s = str(raw, 200);
      if (s) out[key] = s;
    } else if (typeof raw === 'number' && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === 'boolean') {
      out[key] = raw;
    }
  }
  return out;
}

function confidence(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (!value || typeof value !== 'object') return out;
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = Math.min(1, Math.max(0, raw));
  }
  return out;
}

function reservationType(value: unknown): ReservationType {
  return RESERVATION_TYPES.includes(value as ReservationType) ? (value as ReservationType) : 'other';
}

/**
 * Model çıktısını doğrular ve temizler. Başlangıç tarihi okunamayan kalemler
 * atılır, çünkü seyahat planına yerleştirilemezler.
 */
export function normalizeParsedDocument(raw: unknown): ParsedDocument {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const rawItems = Array.isArray(root.items) ? root.items.slice(0, 30) : [];

  const items: ParsedItem[] = [];
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== 'object') continue;
    const r = rawItem as Record<string, unknown>;
    const start = endpoint(r.start);
    if (!start?.local_datetime) continue;
    const type = reservationType(r.type);
    items.push({
      type,
      title: str(r.title, 120) ?? start.place_name ?? type,
      provider_name: str(r.provider_name, 100),
      reference_code: upperCode(r.reference_code),
      start,
      end: endpoint(r.end),
      details: details(r.details),
      confidence: confidence(r.confidence),
    });
  }
  items.sort((a, b) => (a.start.local_datetime ?? '').localeCompare(b.start.local_datetime ?? ''));

  const passengers = Array.isArray(root.passenger_names)
    ? root.passenger_names.map((p) => str(p, 80)).filter((p): p is string => p !== null).slice(0, 20)
    : [];

  return {
    document_type: items[0]?.type ?? reservationType(root.document_type),
    items,
    passenger_names: passengers,
  };
}

/**
 * "2026-11-01T14:30" + "Europe/Rome" → "2026-11-01T13:30:00.000Z".
 * Saat dilimi bilinmiyorsa yerel saat UTC kabul edilir; arayüz bu alanı
 * düşük güvenli gösterir.
 */
export function localToUtcIso(localDateTime: string, timeZone: string | null): string {
  const m = LOCAL_DATETIME.exec(localDateTime);
  if (!m) throw new Error(`invalid local datetime: ${localDateTime}`);
  const [, y, mo, d, h = '00', mi = '00'] = m;
  const asUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi));
  if (!timeZone || !isValidTimeZone(timeZone)) return new Date(asUtc).toISOString();

  // Saat diliminin o andaki farkını bul; yaz saati geçişleri için iki kez düzelt.
  const offsetAt = (utcMs: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(utcMs));
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const wallAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
    return wallAsUtc - utcMs;
  };
  let guess = asUtc - offsetAt(asUtc);
  guess = asUtc - offsetAt(guess);
  return new Date(guess).toISOString();
}

/** Bir kalemin en düşük güven skoru; hiç skor yoksa orta güven varsayılır. */
export function minConfidence(item: ParsedItem): number {
  const values = Object.values(item.confidence);
  return values.length ? Math.min(...values) : 0.5;
}

/** "2026-11-01T13:30:00Z" + "Europe/Rome" → "2026-11-01T14:30". Saat dilimi yoksa UTC. */
export function utcToLocal(iso: string, timeZone: string | null): string {
  const zone = timeZone && isValidTimeZone(timeZone) ? timeZone : 'UTC';
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}
