/** Kur önbelleği için saf mantık (arayüz bağımlılığı yok; testlenebilir). */
export const FX_TTL_MS = 60 * 60 * 1000;

export type CachedRate = { rate: number; at: number };

export function isFresh(entry: CachedRate | undefined, now: number): boolean {
  return !!entry && now - entry.at < FX_TTL_MS;
}

export function rateKey(from: string, to: string): string {
  return `${from.toUpperCase()}>${to.toUpperCase()}`;
}

/** Kur API yanıtından (frankfurter ya da open.er-api) kuru çıkarır; geçersizse null. */
export function parseRate(data: unknown, to: string): number | null {
  const rate = (data as { rates?: Record<string, unknown> } | null)?.rates?.[to.toUpperCase()];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function convert(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** Seçilebilen para birimleri (ISO 4217; open.er-api.com'un desteklediği kümeyle uyumlu). */
export const CURRENCIES = [
  'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD', 'BDT', 'BGN', 'BHD', 'BIF', 'BMD',
  'BND', 'BOB', 'BRL', 'BSD', 'BTN', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF', 'CLP', 'CNY', 'COP', 'CRC', 'CUP', 'CVE',
  'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ERN', 'ETB', 'EUR', 'FJD', 'FKP', 'GBP', 'GEL', 'GGP', 'GHS', 'GIP', 'GMD',
  'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HRK', 'HTG', 'HUF', 'IDR', 'ILS', 'IMP', 'INR', 'IQD', 'IRR', 'ISK', 'JEP', 'JMD',
  'JOD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KPW', 'KRW', 'KWD', 'KYD', 'KZT', 'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'LYD',
  'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MRU', 'MUR', 'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO',
  'NOK', 'NPR', 'NZD', 'OMR', 'PAB', 'PEN', 'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR',
  'SBD', 'SCR', 'SDG', 'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'SSP', 'STN', 'SYP', 'SZL', 'THB', 'TJS', 'TMT', 'TND',
  'TOP', 'TRY', 'TTD', 'TVD', 'TWD', 'TZS', 'UAH', 'UGX', 'USD', 'UYU', 'UZS', 'VES', 'VND', 'VUV', 'WST', 'XAF', 'XCD',
  'XOF', 'XPF', 'YER', 'ZAR', 'ZMW', 'ZWL',
];

/** Para biriminin bayrağı için ülke kodu (EUR için AB bayrağı). */
export const CURRENCY_COUNTRY: Record<string, string> = {
  AED: 'AE', AFN: 'AF', ALL: 'AL', AMD: 'AM', ANG: 'CW', AOA: 'AO', ARS: 'AR', AUD: 'AU', AWG: 'AW', AZN: 'AZ',
  BAM: 'BA', BBD: 'BB', BDT: 'BD', BGN: 'BG', BHD: 'BH', BIF: 'BI', BMD: 'BM', BND: 'BN', BOB: 'BO', BRL: 'BR',
  BSD: 'BS', BTN: 'BT', BWP: 'BW', BYN: 'BY', BZD: 'BZ', CAD: 'CA', CDF: 'CD', CHF: 'CH', CLP: 'CL', CNY: 'CN',
  COP: 'CO', CRC: 'CR', CUP: 'CU', CVE: 'CV', CZK: 'CZ', DJF: 'DJ', DKK: 'DK', DOP: 'DO', DZD: 'DZ', EGP: 'EG',
  ERN: 'ER', ETB: 'ET', EUR: 'EU', FJD: 'FJ', FKP: 'FK', GBP: 'GB', GEL: 'GE', GGP: 'GG', GHS: 'GH', GIP: 'GI',
  GMD: 'GM', GNF: 'GN', GTQ: 'GT', GYD: 'GY', HKD: 'HK', HNL: 'HN', HRK: 'HR', HTG: 'HT', HUF: 'HU', IDR: 'ID',
  ILS: 'IL', IMP: 'IM', INR: 'IN', IQD: 'IQ', IRR: 'IR', ISK: 'IS', JEP: 'JE', JMD: 'JM', JOD: 'JO', JPY: 'JP',
  KES: 'KE', KGS: 'KG', KHR: 'KH', KMF: 'KM', KPW: 'KP', KRW: 'KR', KWD: 'KW', KYD: 'KY', KZT: 'KZ', LAK: 'LA',
  LBP: 'LB', LKR: 'LK', LRD: 'LR', LSL: 'LS', LYD: 'LY', MAD: 'MA', MDL: 'MD', MGA: 'MG', MKD: 'MK', MMK: 'MM',
  MNT: 'MN', MOP: 'MO', MRU: 'MR', MUR: 'MU', MVR: 'MV', MWK: 'MW', MXN: 'MX', MYR: 'MY', MZN: 'MZ', NAD: 'NA',
  NGN: 'NG', NIO: 'NI', NOK: 'NO', NPR: 'NP', NZD: 'NZ', OMR: 'OM', PAB: 'PA', PEN: 'PE', PGK: 'PG', PHP: 'PH',
  PKR: 'PK', PLN: 'PL', PYG: 'PY', QAR: 'QA', RON: 'RO', RSD: 'RS', RUB: 'RU', RWF: 'RW', SAR: 'SA', SBD: 'SB',
  SCR: 'SC', SDG: 'SD', SEK: 'SE', SGD: 'SG', SHP: 'SH', SLE: 'SL', SOS: 'SO', SRD: 'SR', SSP: 'SS', STN: 'ST',
  SYP: 'SY', SZL: 'SZ', THB: 'TH', TJS: 'TJ', TMT: 'TM', TND: 'TN', TOP: 'TO', TRY: 'TR', TTD: 'TT', TVD: 'TV',
  TWD: 'TW', TZS: 'TZ', UAH: 'UA', UGX: 'UG', USD: 'US', UYU: 'UY', UZS: 'UZ', VES: 'VE', VND: 'VN', VUV: 'VU',
  WST: 'WS', XAF: 'CM', XCD: 'AG', XOF: 'SN', XPF: 'PF', YER: 'YE', ZAR: 'ZA', ZMW: 'ZM', ZWL: 'ZW',
};

/** "TRY" → "🇹🇷"; bilinmeyen kod için boş metin. */
export function currencyFlag(code: string): string {
  const country = CURRENCY_COUNTRY[code.toUpperCase()];
  return country ? String.fromCodePoint(...[...country].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65)) : '';
}
