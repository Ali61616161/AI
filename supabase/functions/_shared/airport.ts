// Otel → dönüş havalimanı yol süresi (Google Routes). Son günün planı bu süreye göre kapanır; sabit bir
// "1 saat" varsayımı yerine gerçek süre kullanılır. Hesaplanamazsa null döner ve varsayılan geçerli olur.
import { computeRoutes } from './routes.ts';

export type AirportReservation = {
  type: string;
  title: string;
  starts_at: string;
  address: string | null;
  origin_name: string | null;
  origin_code?: string | null;
};

const AIRPORT_WORD = /airport|havaliman|flughafen|aeropuerto|aéroport|aeroporto|аэропорт|机场/i;

/** Dönüş havalimanı adı: elle verilen ya da en son uçuşun kalkış yeri. */
export function departureAirportName(manual: string | null | undefined, reservations: readonly AirportReservation[]): string | null {
  const typed = manual?.trim();
  const flight = [...reservations].filter((r) => r.type === 'flight').sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  const name = typed || flight?.origin_name?.trim() || flight?.origin_code?.trim() || null;
  if (!name) return null;
  return AIRPORT_WORD.test(name) ? name : `${name} Airport`;
}

/** Son konaklamanın adresi; yoksa null. */
export function lastHotelAddress(reservations: readonly AirportReservation[]): string | null {
  const hotel = [...reservations].filter((r) => r.type === 'hotel' && (r.address || r.title)).sort((a, b) => b.starts_at.localeCompare(a.starts_at))[0];
  return hotel ? [hotel.title, hotel.address].filter(Boolean).join(', ') : null;
}

/** 10-180 dakikaya sıkıştırılmış yol süresi (toplu taşıma; yoksa araba). */
export function clampTransfer(minutes: number): number {
  return Math.min(Math.max(Math.round(minutes), 10), 180);
}

export async function airportTransferMinutes(input: {
  apiKey: string | null;
  apiBase?: string;
  reservations: readonly AirportReservation[];
  manualAirport?: string | null;
  language: string;
  fetchImpl?: typeof fetch;
}): Promise<number | null> {
  if (!input.apiKey) return null;
  const from = lastHotelAddress(input.reservations);
  const to = departureAirportName(input.manualAirport, input.reservations);
  if (!from || !to) return null;
  for (const mode of ['transit', 'drive'] as const) {
    try {
      const routes = await computeRoutes({ apiKey: input.apiKey, apiBase: input.apiBase, origin: { address: from }, destination: { address: to }, mode, language: input.language, fetchImpl: input.fetchImpl });
      if (routes[0]) return clampTransfer(routes[0].durationMin);
    } catch {
      // bu mod olmadı: sıradakini dene
    }
  }
  return null;
}
