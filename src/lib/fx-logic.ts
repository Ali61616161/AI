/** Kur önbelleği için saf mantık (arayüz bağımlılığı yok; testlenebilir). */
export const FX_TTL_MS = 6 * 60 * 60 * 1000;

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
