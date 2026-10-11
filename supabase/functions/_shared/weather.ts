// Google Weather API: günlük tahmin (en fazla 10 gün) ve anlık hava. Anlık hava
// "Planı Değiştir" asistanına verilir; günlük tahmin seyahat detayında gösterilir.
//
// Sunucu sırrı: GOOGLE_MAPS_API_KEY. GOOGLE_WEATHER_API_BASE sadece testlerde kullanılır.

export const WEATHER_API_BASE = 'https://weather.googleapis.com';
export const FORECAST_DAYS_PATH = 'v1/forecast/days:lookup';
export const CURRENT_CONDITIONS_PATH = 'v1/currentConditions:lookup';
export const MAX_FORECAST_DAYS = 10;

export type DayForecast = {
  date: string;
  max: number | null;
  min: number | null;
  condition: string | null;
  description: string | null;
  iconUri: string | null;
  rainChance: number | null;
};

export type CurrentWeather = {
  temperature: number | null;
  feelsLike: number | null;
  condition: string | null;
  description: string | null;
  rainChance: number | null;
  isDaytime: boolean | null;
};

type Query = { lat: number; lng: number; language: string; apiKey: string; apiBase?: string };

function params(q: Query, extra: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams({
    key: q.apiKey,
    'location.latitude': String(q.lat),
    'location.longitude': String(q.lng),
    languageCode: q.language,
    unitsSystem: 'METRIC',
    ...extra,
  });
}

export function forecastUrl(q: Query & { days: number }): string {
  const days = Math.min(Math.max(Math.round(q.days), 1), MAX_FORECAST_DAYS);
  return `${q.apiBase ?? WEATHER_API_BASE}/${FORECAST_DAYS_PATH}?${params(q, { days: String(days), pageSize: String(days) })}`;
}

export function currentUrl(q: Query): string {
  return `${q.apiBase ?? WEATHER_API_BASE}/${CURRENT_CONDITIONS_PATH}?${params(q)}`;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const pad = (n: number) => String(n).padStart(2, '0');

// deno-lint-ignore no-explicit-any
function condition(c: any) {
  return {
    condition: str(c?.type),
    description: str(c?.description?.text),
    iconUri: typeof c?.iconBaseUri === 'string' && c.iconBaseUri.startsWith('https://') ? c.iconBaseUri : null,
  };
}

export function normalizeForecast(raw: unknown): DayForecast[] {
  // deno-lint-ignore no-explicit-any
  const days = (raw as any)?.forecastDays;
  if (!Array.isArray(days)) return [];
  return days
    .map((d) => {
      const date = d?.displayDate;
      if (!num(date?.year) || !num(date?.month) || !num(date?.day)) return null;
      const daytime = d.daytimeForecast ?? {};
      const c = condition(daytime.weatherCondition);
      return {
        date: `${date.year}-${pad(date.month)}-${pad(date.day)}`,
        max: num(d.maxTemperature?.degrees),
        min: num(d.minTemperature?.degrees),
        condition: c.condition,
        description: c.description,
        iconUri: c.iconUri,
        rainChance: num(daytime.precipitation?.probability?.percent),
      };
    })
    .filter((d): d is DayForecast => d !== null);
}

export function normalizeCurrent(raw: unknown): CurrentWeather | null {
  if (!raw || typeof raw !== 'object') return null;
  // deno-lint-ignore no-explicit-any
  const r = raw as any;
  const c = condition(r.weatherCondition);
  const result = {
    temperature: num(r.temperature?.degrees),
    feelsLike: num(r.feelsLikeTemperature?.degrees),
    condition: c.condition,
    description: c.description,
    rainChance: num(r.precipitation?.probability?.percent),
    isDaytime: typeof r.isDaytime === 'boolean' ? r.isDaytime : null,
  };
  return result.temperature === null && result.condition === null ? null : result;
}

/** Asistan istemi için tek satırlık özet. */
export function weatherForPrompt(w: CurrentWeather | null): string | null {
  if (!w) return null;
  const parts = [
    w.description ?? w.condition,
    w.temperature !== null ? `${Math.round(w.temperature)}°C` : null,
    w.feelsLike !== null && w.temperature !== null && Math.abs(w.feelsLike - w.temperature) >= 2 ? `feels like ${Math.round(w.feelsLike)}°C` : null,
    w.rainChance !== null ? `${w.rainChance}% chance of rain` : null,
    w.isDaytime === false ? 'dark outside' : null,
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : null;
}

async function getJson(url: string, fetchImpl: typeof fetch = fetch, timeoutMs = 8_000): Promise<unknown> {
  const res = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`weather http ${res.status}: ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

export async function fetchForecast(q: Query & { days: number; fetchImpl?: typeof fetch }): Promise<DayForecast[]> {
  return normalizeForecast(await getJson(forecastUrl(q), q.fetchImpl));
}

export async function fetchCurrent(q: Query & { fetchImpl?: typeof fetch }): Promise<CurrentWeather | null> {
  return normalizeCurrent(await getJson(currentUrl(q), q.fetchImpl));
}
