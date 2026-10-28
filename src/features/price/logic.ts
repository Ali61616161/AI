// Fiyat takibi için saf mantık (arayüz bağımlılığı yok; testlenebilir).

export const WATCH_CURRENCIES = ['EUR', 'USD', 'TRY', 'GBP'] as const;
export type WatchCurrency = (typeof WATCH_CURRENCIES)[number];
export const MAX_ACTIVE_WATCHES = 5;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

export type WatchForm = {
  origin: { code: string; name: string } | null;
  destination: { code: string; name: string } | null;
  depart: string;
  ret: string;
  flexible: boolean;
  target: string;
};

export type FormProblem = 'route' | 'depart' | 'past' | 'return' | 'target';

/** Tarih alanı: esnek aydaysa YYYY-AA da kabul edilir (ayın ilk günü olarak saklanır). */
export function normalizeDate(value: string, flexible: boolean): string | null {
  const v = value.trim();
  if (DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v) return v;
  if (flexible && MONTH.test(v)) {
    const m = Number(v.slice(5));
    return m >= 1 && m <= 12 ? `${v}-01` : null;
  }
  return null;
}

export function parseTarget(value: string): number | null | 'invalid' {
  const v = value.trim().replace(',', '.');
  if (v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : 'invalid';
}

/** Formdaki ilk sorun (yoksa null). `today` YYYY-MM-DD. */
export function formProblem(f: WatchForm, today: string): FormProblem | null {
  if (!f.origin || !f.destination || f.origin.code === f.destination.code) return 'route';
  const depart = normalizeDate(f.depart, f.flexible);
  if (!depart) return 'depart';
  const lastDay = f.flexible ? `${depart.slice(0, 7)}-31` : depart;
  if (lastDay < today) return 'past';
  if (f.ret.trim() !== '') {
    const ret = normalizeDate(f.ret, f.flexible);
    if (!ret || ret <= depart) return 'return';
  }
  if (parseTarget(f.target) === 'invalid') return 'target';
  return null;
}

export type Trend = 'down' | 'up' | 'flat';

/** Son iki noktaya göre eğilim ve yüzde değişim. */
export function trend(points: { d: string; p: number }[]): { trend: Trend; pct: number } | null {
  if (points.length < 2) return null;
  const prev = points[points.length - 2].p;
  const last = points[points.length - 1].p;
  const pct = prev > 0 ? Math.round(((last - prev) / prev) * 100) : 0;
  return { trend: pct < 0 ? 'down' : pct > 0 ? 'up' : 'flat', pct };
}

export function parsePoints(value: unknown): { d: string; p: number }[] {
  return (Array.isArray(value) ? value : []).filter((x): x is { d: string; p: number } => typeof x?.d === 'string' && typeof x?.p === 'number');
}
