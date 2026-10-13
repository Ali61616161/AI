// Ulaşım bileti bağlantıları: araç türüne (tren, otobüs, feribot, uçak, araba) ve
// bölgeye göre en uygun ortaklar seçilir. Ortaklık kimlikleri koda yazılmaz; her ortağın
// bağlantı şablonu sunucu ortam değişkeninden okunur (ortaklık panelindeki "deep link").
// Şablonu girilmemiş ortak gösterilmez; her durumda kimlik gerektirmeyen yedekler
// (Rome2rio: dünyanın her yeri, her araç; Google Flights: uçuş) çalışır.
//
// Ortam değişkenleri (isteğe bağlı, https ile başlamalı):
//   AFFILIATE_OMIO_URL, AFFILIATE_TRAINLINE_URL, AFFILIATE_12GO_URL, AFFILIATE_FERRYHOPPER_URL,
//   AFFILIATE_BUSBUD_URL, AFFILIATE_KIWI_URL, AFFILIATE_SKYSCANNER_URL, AFFILIATE_DISCOVERCARS_URL,
//   AFFILIATE_ROME2RIO_URL (varsayılanın yerine geçer)
// Yer tutucular: {from} {to} {date} {adults} {lang} {from_iata} {to_iata} {flight_query}

import { CONTINENT_OF } from './continents.ts';

export type TicketMode = 'train' | 'bus' | 'ferry' | 'flight' | 'car';

export type TransportPartner =
  | 'omio'
  | 'trainline'
  | '12go'
  | 'ferryhopper'
  | 'busbud'
  | 'kiwi'
  | 'skyscanner'
  | 'discovercars'
  | 'rome2rio'
  | 'google_flights';

/** Kimlik gerektirmeyen, her zaman çalışan bağlantılar. */
const FALLBACK_TEMPLATES: Partial<Record<TransportPartner, string>> = {
  rome2rio: 'https://www.rome2rio.com/map/{from}/{to}',
  google_flights: 'https://www.google.com/travel/flights?q={flight_query}',
};

const ENV_NAMES: Record<TransportPartner, string> = {
  omio: 'AFFILIATE_OMIO_URL',
  trainline: 'AFFILIATE_TRAINLINE_URL',
  '12go': 'AFFILIATE_12GO_URL',
  ferryhopper: 'AFFILIATE_FERRYHOPPER_URL',
  busbud: 'AFFILIATE_BUSBUD_URL',
  kiwi: 'AFFILIATE_KIWI_URL',
  skyscanner: 'AFFILIATE_SKYSCANNER_URL',
  discovercars: 'AFFILIATE_DISCOVERCARS_URL',
  rome2rio: 'AFFILIATE_ROME2RIO_URL',
  google_flights: 'AFFILIATE_GOOGLE_FLIGHTS_URL',
};

export type TransportTemplates = Partial<Record<TransportPartner, string>>;

/** Ortamdaki şablonları okur; sadece https ve en az bir yer tutucu içerenler kabul edilir. */
export function transportTemplatesFromEnv(get: (name: string) => string | undefined): TransportTemplates {
  const out: TransportTemplates = {};
  for (const partner of Object.keys(ENV_NAMES) as TransportPartner[]) {
    const value = get(ENV_NAMES[partner])?.trim();
    if (value && value.startsWith('https://') && /\{(from|to|from_iata|to_iata|flight_query)\}/.test(value)) out[partner] = value;
  }
  return out;
}

// 12Go'nun güçlü olduğu Güney, Güneydoğu ve Doğu Asya.
const ASIA_12GO = new Set(['TH', 'VN', 'KH', 'LA', 'MY', 'SG', 'ID', 'PH', 'MM', 'JP', 'KR', 'CN', 'TW', 'HK', 'MO', 'IN', 'LK', 'NP', 'BD']);
// Avrupa'daki feribot hatları (Akdeniz, Ege, Adriyatik, Baltık, Manş).
const isEurope = (c: string | null) => Boolean(c && (CONTINENT_OF[c] === 'europe' || c === 'TR' || c === 'CY' || c === 'GE'));
const isAmericas = (c: string | null) => Boolean(c && (CONTINENT_OF[c] === 'north_america' || CONTINENT_OF[c] === 'south_america'));

/** Araç ve bölgeye göre ortak sırası (en uygun önce). */
export function partnersFor(mode: TicketMode, country: string | null): TransportPartner[] {
  const c = country?.toUpperCase() ?? null;
  const asia = Boolean(c && ASIA_12GO.has(c));
  switch (mode) {
    case 'train':
      return asia ? ['12go', 'omio'] : isEurope(c) ? ['trainline', 'omio'] : ['omio', '12go'];
    case 'bus':
      return asia ? ['12go', 'busbud'] : isEurope(c) ? ['omio', 'busbud'] : isAmericas(c) ? ['busbud', 'omio'] : ['busbud', '12go'];
    case 'ferry':
      return asia ? ['12go', 'ferryhopper'] : ['ferryhopper', 'omio'];
    case 'flight':
      return ['kiwi', 'skyscanner', 'omio'];
    case 'car':
      return ['discovercars'];
  }
}

export type TicketQuery = {
  mode: TicketMode;
  from: string;
  to: string;
  /** Kalkış ülkesi (ISO-2); ortak seçimi için. */
  country?: string | null;
  date?: string | null;
  adults?: number | null;
  lang?: string | null;
  fromIata?: string | null;
  toIata?: string | null;
};

export type TicketOption = { partner: TransportPartner; mode: TicketMode; url: string; affiliate: boolean };

function fill(template: string, q: TicketQuery): string | null {
  const date = q.date && /^\d{4}-\d{2}-\d{2}$/.test(q.date) ? q.date : null;
  const values: Record<string, string | null> = {
    from: q.from,
    to: q.to,
    date,
    adults: q.adults ? String(q.adults) : null,
    lang: q.lang ?? null,
    from_iata: q.fromIata ?? null,
    to_iata: q.toIata ?? null,
    flight_query: `Flights from ${q.from} to ${q.to}${date ? ` on ${date}` : ''}`,
  };
  // IATA isteyen şablon kod yoksa kullanılamaz.
  if ((template.includes('{from_iata}') && !values.from_iata) || (template.includes('{to_iata}') && !values.to_iata)) return null;
  const filled = template.replace(/\{(from|to|date|adults|lang|from_iata|to_iata|flight_query)\}/g, (_, key: string) => encodeURIComponent(values[key] ?? ''));
  try {
    const url = new URL(filled);
    url.search = new URLSearchParams([...url.searchParams.entries()].filter(([, v]) => v !== '')).toString();
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * Bir yolculuk için bilet bağlantıları: bölgeye uygun ve şablonu girilmiş ortaklar önce,
 * ardından her zaman çalışan yedekler. En fazla `limit` bağlantı.
 */
export function ticketOptions(q: TicketQuery, templates: TransportTemplates, limit = 3): TicketOption[] {
  const out: TicketOption[] = [];
  const seen = new Set<string>();
  const add = (partner: TransportPartner, template: string | undefined, affiliate: boolean) => {
    if (!template || out.length >= limit || seen.has(partner)) return;
    const url = fill(template, q);
    if (!url) return;
    seen.add(partner);
    out.push({ partner, mode: q.mode, url, affiliate });
  };
  for (const p of partnersFor(q.mode, q.country ?? null)) add(p, templates[p], true);
  if (q.mode === 'flight') add('google_flights', templates.google_flights ?? FALLBACK_TEMPLATES.google_flights, Boolean(templates.google_flights));
  if (q.mode !== 'car') add('rome2rio', templates.rome2rio ?? FALLBACK_TEMPLATES.rome2rio, Boolean(templates.rome2rio));
  return out;
}

export type NavMode = 'transit' | 'drive' | 'walk';
export type NavPoint = { lat: number; lng: number } | string;

const point = (p: NavPoint) => (typeof p === 'string' ? p : `${p.lat},${p.lng}`);

/** Google Haritalar yol tarifi (uygulama yüklüyse açılır; anahtar gerekmez). */
export function navigationUrl(origin: NavPoint | null, destination: NavPoint, mode: NavMode): string {
  const params = new URLSearchParams({ api: '1', destination: point(destination), travelmode: mode === 'drive' ? 'driving' : mode === 'walk' ? 'walking' : 'transit' });
  if (origin) params.set('origin', point(origin));
  return `https://www.google.com/maps/dir/?${params}`;
}
