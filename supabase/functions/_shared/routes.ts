// Google Routes API (computeRoutes): toplu taşıma, araba ve yürüyüş güzergahı.
// Toplu taşıma, Google'a tarifelerini veren dünyadaki işletmecileri kapsar (ulusal ve
// özel demiryolları, bölgesel trenler, metro, tramvay, otobüs, feribot, teleferik, füniküler).
// Cevaptaki her alan isteğe bağlı kabul edilir; eksik alan güzergahı bozmaz.
//
// Sunucu sırrı: GOOGLE_MAPS_API_KEY. GOOGLE_ROUTES_API_BASE sadece testlerde kullanılır.

export const ROUTES_API_BASE = 'https://routes.googleapis.com';
export const COMPUTE_ROUTES_PATH = 'directions/v2:computeRoutes';

export const ROUTE_FIELD_MASK = [
  'routes.duration',
  'routes.distanceMeters',
  'routes.localizedValues',
  'routes.travelAdvisory.transitFare',
  'routes.legs.steps.travelMode',
  'routes.legs.steps.staticDuration',
  'routes.legs.steps.distanceMeters',
  'routes.legs.steps.navigationInstruction',
  'routes.legs.steps.transitDetails',
].join(',');

export type RouteMode = 'transit' | 'drive' | 'walk';
export type RoutePoint = { lat: number; lng: number } | { address: string };

export type VehicleKind = 'train' | 'high_speed_train' | 'subway' | 'tram' | 'bus' | 'ferry' | 'cable_car' | 'funicular' | 'other';

export type TransitInfo = {
  vehicle: VehicleKind;
  vehicleName: string | null;
  line: string | null;
  lineShort: string | null;
  color: string | null;
  textColor: string | null;
  headsign: string | null;
  agency: string | null;
  agencyUrl: string | null;
  from: string | null;
  to: string | null;
  departAt: string | null;
  arriveAt: string | null;
  departTime: string | null;
  stops: number | null;
  /** Şehirlerarası tren/otobüs veya feribot: bilet bağlantısı gösterilir. */
  longDistance: boolean;
};

export type RouteStep = {
  mode: 'walk' | 'transit' | 'drive';
  durationMin: number;
  distanceM: number;
  instruction: string | null;
  transit: TransitInfo | null;
};

export type RouteOption = {
  durationMin: number;
  distanceKm: number;
  durationText: string | null;
  distanceText: string | null;
  fare: { amount: number; currency: string } | null;
  fareText: string | null;
  departAt: string | null;
  arriveAt: string | null;
  steps: RouteStep[];
};

export class RoutesError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'RoutesError';
  }
}

const VEHICLES: Record<string, VehicleKind> = {
  RAIL: 'train',
  HEAVY_RAIL: 'train',
  COMMUTER_TRAIN: 'train',
  LONG_DISTANCE_TRAIN: 'train',
  MONORAIL: 'train',
  HIGH_SPEED_TRAIN: 'high_speed_train',
  METRO_RAIL: 'subway',
  SUBWAY: 'subway',
  TRAM: 'tram',
  BUS: 'bus',
  INTERCITY_BUS: 'bus',
  TROLLEYBUS: 'bus',
  SHARE_TAXI: 'bus',
  FERRY: 'ferry',
  CABLE_CAR: 'cable_car',
  GONDOLA_LIFT: 'cable_car',
  FUNICULAR: 'funicular',
};

/** Uzun yol sayılan araç türleri. */
const LONG_DISTANCE_TYPES = new Set(['LONG_DISTANCE_TRAIN', 'HIGH_SPEED_TRAIN', 'INTERCITY_BUS', 'FERRY']);

const waypoint = (p: RoutePoint) => ('address' in p ? { address: p.address } : { location: { latLng: { latitude: p.lat, longitude: p.lng } } });

export function routesRequest(input: { origin: RoutePoint; destination: RoutePoint; mode: RouteMode; departAt?: string | null; language: string }) {
  const body: Record<string, unknown> = {
    origin: waypoint(input.origin),
    destination: waypoint(input.destination),
    travelMode: input.mode === 'drive' ? 'DRIVE' : input.mode === 'walk' ? 'WALK' : 'TRANSIT',
    languageCode: input.language,
    units: 'METRIC',
    computeAlternativeRoutes: input.mode !== 'walk',
  };
  // Kalkış saati sadece gelecekteyse gönderilir (geçmiş saat API'de hata verir).
  if (input.departAt && Date.parse(input.departAt) > Date.now()) body.departureTime = new Date(input.departAt).toISOString();
  if (input.mode === 'drive') body.routingPreference = 'TRAFFIC_AWARE';
  return body;
}

const seconds = (v: unknown) => {
  const n = typeof v === 'string' ? Number.parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n >= 0 ? n : 0;
};
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const httpsUrl = (v: unknown) => {
  const s = str(v);
  return s && /^https?:\/\//.test(s) ? s.replace(/^http:/, 'https:') : null;
};
const color = (v: unknown) => {
  const s = str(v);
  return s && /^#[0-9a-fA-F]{6}$/.test(s) ? s : null;
};

// deno-lint-ignore no-explicit-any
function transitInfo(d: any): TransitInfo {
  const line = d?.transitLine ?? {};
  const agency = Array.isArray(line.agencies) ? line.agencies[0] : null;
  const type = str(line.vehicle?.type) ?? 'OTHER';
  return {
    vehicle: VEHICLES[type] ?? 'other',
    vehicleName: str(line.vehicle?.name?.text),
    line: str(line.name),
    lineShort: str(line.nameShort),
    color: color(line.color),
    textColor: color(line.textColor),
    headsign: str(d?.headsign),
    agency: str(agency?.name),
    agencyUrl: httpsUrl(agency?.uri) ?? httpsUrl(line.uri),
    from: str(d?.stopDetails?.departureStop?.name),
    to: str(d?.stopDetails?.arrivalStop?.name),
    departAt: str(d?.localizedValues?.departureTime?.time?.text),
    arriveAt: str(d?.localizedValues?.arrivalTime?.time?.text),
    departTime: str(d?.stopDetails?.departureTime),
    stops: typeof d?.stopCount === 'number' ? d.stopCount : null,
    longDistance: LONG_DISTANCE_TYPES.has(type),
  };
}

/** Routes API cevabını uygulamanın kullandığı sade biçime çevirir. */
// deno-lint-ignore no-explicit-any
export function normalizeRoutes(data: any, mode: RouteMode): RouteOption[] {
  const routes = Array.isArray(data?.routes) ? data.routes : [];
  // deno-lint-ignore no-explicit-any
  return routes.slice(0, 3).map((r: any): RouteOption => {
    // deno-lint-ignore no-explicit-any
    const rawSteps: any[] = (Array.isArray(r.legs) ? r.legs : []).flatMap((l: any) => (Array.isArray(l.steps) ? l.steps : []));
    const steps: RouteStep[] = [];
    for (const s of rawSteps) {
      const isTransit = s.travelMode === 'TRANSIT' && s.transitDetails;
      const step: RouteStep = {
        mode: isTransit ? 'transit' : mode === 'drive' ? 'drive' : 'walk',
        durationMin: Math.round(seconds(s.staticDuration) / 60),
        distanceM: Math.round(seconds(s.distanceMeters)),
        instruction: str(s.navigationInstruction?.instructions),
        transit: isTransit ? transitInfo(s.transitDetails) : null,
      };
      // Toplu taşımada art arda yürüme adımları tek adımda birleştirilir.
      const prev = steps[steps.length - 1];
      if (mode === 'transit' && step.mode === 'walk' && prev?.mode === 'walk') {
        prev.durationMin += step.durationMin;
        prev.distanceM += step.distanceM;
      } else steps.push(step);
    }
    // Araba ve yürüyüşte adım adım tarif haritaya bırakılır; sadece özet gösterilir.
    const visible = mode === 'transit' ? steps.filter((s) => s.mode === 'transit' || s.durationMin >= 1) : [];
    const transit = visible.filter((s) => s.transit);
    const fare = r.travelAdvisory?.transitFare;
    const units = Number(fare?.units ?? 0) + Number(fare?.nanos ?? 0) / 1e9;
    return {
      durationMin: Math.round(seconds(r.duration) / 60),
      distanceKm: Math.round(seconds(r.distanceMeters) / 100) / 10,
      durationText: str(r.localizedValues?.duration?.text) ?? str(r.localizedValues?.staticDuration?.text),
      distanceText: str(r.localizedValues?.distance?.text),
      fare: fare?.currencyCode && Number.isFinite(units) && units > 0 ? { amount: Math.round(units * 100) / 100, currency: fare.currencyCode } : null,
      fareText: str(r.localizedValues?.transitFare?.text),
      departAt: transit.find((t) => t.transit?.departAt)?.transit?.departAt ?? null,
      arriveAt: transit.findLast((t) => t.transit?.arriveAt)?.transit?.arriveAt ?? null,
      steps: visible,
    };
  });
}

export async function computeRoutes(input: {
  apiKey: string;
  apiBase?: string;
  origin: RoutePoint;
  destination: RoutePoint;
  mode: RouteMode;
  departAt?: string | null;
  language: string;
  fetchImpl?: typeof fetch;
}): Promise<RouteOption[]> {
  const res = await (input.fetchImpl ?? fetch)(`${input.apiBase ?? ROUTES_API_BASE}/${COMPUTE_ROUTES_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': input.apiKey, 'x-goog-fieldmask': ROUTE_FIELD_MASK },
    body: JSON.stringify(routesRequest(input)),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new RoutesError(`Routes HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 200)}`, res.status);
  return normalizeRoutes(await res.json(), input.mode);
}
