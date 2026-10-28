// Uçak bileti fiyat takibi: sağlayıcı yanıtını (Travelpayouts/Aviasales Data API) okuma, bildirim kararı
// ve bildirim metinleri. Ağ çağrısı yapan kısım fetchCheapest'tir; kalanlar saf işlevlerdir.

export type Cheapest = { price: number; airline: string | null };

export type WatchQuery = {
  origin: string;
  destination: string;
  departOn: string;
  returnOn: string | null;
  flexibleMonth: boolean;
  currency: string;
};

const API = 'https://api.travelpayouts.com/aviasales/v3/prices_for_dates';

/** Sağlayıcı yanıtından en ucuz bilet; beklenmedik biçimde ya da boşsa null. */
export function parseCheapest(body: unknown): Cheapest | null {
  const data = (body as { data?: unknown } | null)?.data;
  if (!Array.isArray(data)) return null;
  let best: Cheapest | null = null;
  for (const row of data) {
    const price = Number((row as { price?: unknown })?.price);
    if (!Number.isFinite(price) || price <= 0 || price > 1_000_000) continue;
    if (!best || price < best.price) {
      const airline = (row as { airline?: unknown }).airline;
      best = { price: Math.round(price * 100) / 100, airline: typeof airline === 'string' && /^[A-Z0-9]{2,3}$/i.test(airline) ? airline.toUpperCase() : null };
    }
  }
  return best;
}

export function buildQueryUrl(q: WatchQuery): string {
  const params = new URLSearchParams({
    origin: q.origin,
    destination: q.destination,
    departure_at: q.flexibleMonth ? q.departOn.slice(0, 7) : q.departOn,
    one_way: q.returnOn ? 'false' : 'true',
    currency: q.currency.toLowerCase(),
    sorting: 'price',
    limit: '1',
    unique: 'false',
  });
  if (q.returnOn) params.set('return_at', q.flexibleMonth ? q.returnOn.slice(0, 7) : q.returnOn);
  return `${API}?${params}`;
}

export async function fetchCheapest(token: string, q: WatchQuery, fetchImpl: typeof fetch = fetch): Promise<Cheapest | null> {
  const res = await fetchImpl(buildQueryUrl(q), { headers: { 'x-access-token': token, accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`price provider HTTP ${res.status}`);
  return parseCheapest(await res.json());
}

export type Decision = { alert: boolean };

/**
 * Bildirim kararı. Hedef fiyat varsa: fiyat hedefe ulaştı ve daha önce bildirilenden en az %5 düştü.
 * Hedef yoksa: bir önceki kontrole göre en az %10 düştü (ve yine son bildirimden %5 düşük).
 */
export function shouldAlert(input: { price: number; target: number | null; previous: number | null; lastAlert: number | null }): boolean {
  const { price, target, previous, lastAlert } = input;
  const freshEnough = lastAlert === null || price <= lastAlert * 0.95;
  if (target !== null) return price <= target && freshEnough;
  return previous !== null && price <= previous * 0.9 && freshEnough;
}

export type Point = { d: string; p: number };

/** Fiyat geçmişine bugünkü fiyatı ekler (günde tek nokta, en çok 30). */
export function appendPoint(points: unknown, day: string, price: number): Point[] {
  const list = (Array.isArray(points) ? points : []).filter((x): x is Point => typeof (x as Point)?.d === 'string' && typeof (x as Point)?.p === 'number');
  const rest = list.filter((x) => x.d !== day);
  return [...rest, { d: day, p: price }].slice(-30);
}

const TITLES: Record<string, (route: string) => string> = {
  tr: (r) => `Bilet fiyatı düştü: ${r}`,
  en: (r) => `Flight price dropped: ${r}`,
  de: (r) => `Flugpreis gesunken: ${r}`,
  es: (r) => `Bajó el precio del vuelo: ${r}`,
  fr: (r) => `Le prix du vol a baissé : ${r}`,
  it: (r) => `Il prezzo del volo è sceso: ${r}`,
  ru: (r) => `Цена на билет снизилась: ${r}`,
  zh: (r) => `机票降价：${r}`,
  ar: (r) => `انخفض سعر التذكرة: ${r}`,
};
const BODIES: Record<string, (price: string, target: string | null) => string> = {
  tr: (p, t) => (t ? `En ucuz ${p} · hedefin ${t}` : `En ucuz ${p}`),
  en: (p, t) => (t ? `Cheapest now ${p} · your target ${t}` : `Cheapest now ${p}`),
  de: (p, t) => (t ? `Jetzt ab ${p} · dein Ziel ${t}` : `Jetzt ab ${p}`),
  es: (p, t) => (t ? `Ahora desde ${p} · tu objetivo ${t}` : `Ahora desde ${p}`),
  fr: (p, t) => (t ? `Dès ${p} maintenant · ton objectif ${t}` : `Dès ${p} maintenant`),
  it: (p, t) => (t ? `Ora da ${p} · il tuo obiettivo ${t}` : `Ora da ${p}`),
  ru: (p, t) => (t ? `Сейчас от ${p} · ваша цель ${t}` : `Сейчас от ${p}`),
  zh: (p, t) => (t ? `当前最低 ${p} · 你的目标 ${t}` : `当前最低 ${p}`),
  ar: (p, t) => (t ? `الأقل الآن ${p} · هدفك ${t}` : `الأقل الآن ${p}`),
};

export function formatPrice(amount: number, currency: string, language: string): string {
  try {
    return new Intl.NumberFormat(language, { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${Math.round(amount)} ${currency}`;
  }
}

export function alertMessage(language: string, input: { origin: string; destination: string; price: number; target: number | null; currency: string }): { title: string; body: string } {
  const lang = language in TITLES ? language : 'en';
  return {
    title: TITLES[lang](`${input.origin} → ${input.destination}`),
    body: BODIES[lang](formatPrice(input.price, input.currency, lang), input.target === null ? null : formatPrice(input.target, input.currency, lang)),
  };
}
