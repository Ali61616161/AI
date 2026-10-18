// Rota ekranının başlangıç noktası mantığı (saf fonksiyon; arayüz bağımlılığı yok).
// Kullanıcı hedeften çok uzaktaysa (ör. evinden Zürih'e "toplu taşıma" tarifi anlamsız) ve
// seyahatinde uçuş ya da otel rezervasyonu varsa, rota o noktadan başlatılır.

/** Bu mesafeden uzaktaki hedefe "Konumum"dan toplu taşıma/araba rotası kurulmaz. */
export const FAR_KM = 150;

type Reservation = {
  type: string;
  title: string;
  starts_at: string;
  address: string | null;
  destination_name: string | null;
  destination_code: string | null;
};

export type TripOrigin = { address: string; name: string };

/** İki koordinat arası kuş uçuşu mesafe (km). */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

export function isFar(a: { lat: number; lng: number }, b: { lat: number; lng: number }): boolean {
  return distanceKm(a, b) > FAR_KM;
}

/**
 * Seyahatte bilinen en iyi başlangıç: otel rezervasyonu (adresiyle), yoksa ilk uçuşun
 * ya da trenin varış noktası (havalimanı/istasyon). Hiçbiri yoksa null.
 */
export function pickTripOrigin(reservations: readonly Reservation[]): TripOrigin | null {
  const byStart = [...reservations].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const hotel = byStart.find((r) => r.type === 'hotel' && (r.address || r.title));
  if (hotel) return { address: [hotel.title, hotel.address].filter(Boolean).join(', '), name: hotel.title };
  const arrival = byStart.find((r) => (r.type === 'flight' || r.type === 'train') && (r.destination_name || r.destination_code));
  if (arrival) {
    const name = arrival.destination_name ?? arrival.destination_code!;
    const label = arrival.type === 'flight' && !/airport|havaliman|aeropuerto|flughafen|aéroport|aeroporto|аэропорт/i.test(name) ? `${name} Airport` : name;
    return { address: label, name };
  }
  return null;
}
