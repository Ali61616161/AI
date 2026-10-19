/** Kur önbelleği için saf mantık (arayüz bağımlılığı yok; testlenebilir). */
export const FX_TTL_MS = 60 * 60 * 1000;

export type CachedRate = { rate: number; at: number };

export function isFresh(entry: CachedRate | undefined, now: number): boolean {
  return !!entry && now - entry.at < FX_TTL_MS;
}

export function rateKey(from: string, to: string): string {
  return `${from.toUpperCase()}>${to.toUpperCase()}`;
}

/** Frankfurter yanıtından kuru çıkarır; geçersizse null. */
export function parseRate(data: unknown, to: string): number | null {
  const rate = (data as { rates?: Record<string, unknown> } | null)?.rates?.[to.toUpperCase()];
  return typeof rate === 'number' && Number.isFinite(rate) && rate > 0 ? rate : null;
}

export function convert(amount: number, rate: number): number {
  return Math.round(amount * rate * 100) / 100;
}

/** Frankfurter (AMB) kuruyla desteklenen para birimleri. */
export const CURRENCIES = [
  'AUD', 'BRL', 'CAD', 'CHF', 'CNY', 'CZK', 'DKK', 'EUR', 'GBP', 'HKD', 'HUF', 'IDR', 'ILS', 'INR', 'ISK', 'JPY', 'KRW', 'MXN',
  'MYR', 'NOK', 'NZD', 'PHP', 'PLN', 'RON', 'SEK', 'SGD', 'THB', 'TRY', 'USD', 'ZAR',
];
