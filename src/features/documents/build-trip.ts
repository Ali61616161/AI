// Onaylanan belge kalemlerinden seyahat taslağı çıkarır: tarihler, uğranan
// şehirler, başlık ve veritabanına yazılacak rezervasyonlar. Saf fonksiyondur;
// uygulama ve Deno testleri aynı kodu kullanır.
import { localToUtcIso, type ParsedItem } from '../../../supabase/functions/_shared/documents.ts';

export type DraftItem = ParsedItem & {
  /** Arayüzdeki kart anahtarı. */
  key: string;
  documentId: string;
};

export type DestinationDraft = {
  city: string;
  country_code: string | null;
  arrive_on: string | null;
  depart_on: string | null;
};

export type ReservationPayload = {
  document_id: string;
  type: ParsedItem['type'];
  title: string;
  provider_name: string | null;
  reference_code: string | null;
  starts_at: string;
  ends_at: string | null;
  start_timezone: string | null;
  end_timezone: string | null;
  origin_name: string | null;
  origin_code: string | null;
  destination_name: string | null;
  destination_code: string | null;
  address: string | null;
  details: ParsedItem['details'];
};

export type TripDraft = {
  title: string;
  start_date: string;
  end_date: string;
  destinations: DestinationDraft[];
  reservations: ReservationPayload[];
};

const TRANSPORT = new Set<ParsedItem['type']>(['flight', 'train', 'bus']);

const dateOf = (local: string | null | undefined) => (local ? local.slice(0, 10) : null);
const sameCity = (a: string | null | undefined, b: string | null | undefined) =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

function toReservation(item: DraftItem): ReservationPayload {
  const startsAt = localToUtcIso(item.start.local_datetime!, item.start.timezone);
  let endsAt: string | null = null;
  if (item.end?.local_datetime) {
    endsAt = localToUtcIso(item.end.local_datetime, item.end.timezone ?? item.start.timezone);
    // Veritabanı bitişin başlangıçtan önce olmasına izin vermez; hatalı okunmuş
    // bitiş saatini kaydetmek yerine boş bırakıyoruz.
    if (endsAt < startsAt) endsAt = null;
  }
  const transport = TRANSPORT.has(item.type);
  return {
    document_id: item.documentId,
    type: item.type,
    title: item.title,
    provider_name: item.provider_name,
    reference_code: item.reference_code,
    starts_at: startsAt,
    ends_at: endsAt,
    start_timezone: item.start.timezone,
    end_timezone: item.end?.timezone ?? null,
    origin_name: transport ? (item.start.place_name ?? item.start.city) : null,
    origin_code: transport ? item.start.code : null,
    destination_name: transport ? (item.end?.place_name ?? item.end?.city ?? null) : null,
    destination_code: transport ? (item.end?.code ?? null) : null,
    address: transport ? null : (item.start.address ?? item.start.place_name),
    details: item.details,
  };
}

/**
 * @param homeCity Kullanıcının yaşadığı şehir. Verilmezse ilk ulaşım kaleminin
 *   kalkış şehri ev kabul edilir; ev şehri seyahat durağı olarak eklenmez.
 */
export function buildTripDraft(input: DraftItem[], options: { homeCity?: string | null } = {}): TripDraft {
  const items = input
    .filter((i) => i.start.local_datetime)
    .sort((a, b) => a.start.local_datetime!.localeCompare(b.start.local_datetime!));
  if (items.length === 0) throw new Error('no items with a start date');

  const startDate = dateOf(items[0].start.local_datetime)!;
  const endDate = items
    .map((i) => dateOf(i.end?.local_datetime) ?? dateOf(i.start.local_datetime)!)
    .reduce((max, d) => (d > max ? d : max), startDate);

  const firstTransport = items.find((i) => TRANSPORT.has(i.type));
  const home = options.homeCity ?? (items[0] === firstTransport ? firstTransport.start.city : null);

  // Her kalemden "o tarihte bu şehirdeyim" bilgisini çıkar.
  const stops: DestinationDraft[] = [];
  for (const item of items) {
    let stop: DestinationDraft | null = null;
    if (TRANSPORT.has(item.type)) {
      const city = item.end?.city;
      if (city && !sameCity(city, home)) {
        stop = {
          city,
          country_code: item.end?.country_code ?? null,
          arrive_on: dateOf(item.end?.local_datetime) ?? dateOf(item.start.local_datetime),
          depart_on: null,
        };
      }
    } else if (item.start.city && !sameCity(item.start.city, home)) {
      stop = {
        city: item.start.city,
        country_code: item.start.country_code,
        arrive_on: dateOf(item.start.local_datetime),
        depart_on: item.type === 'hotel' ? dateOf(item.end?.local_datetime) : null,
      };
    }
    if (!stop) continue;

    const last = stops[stops.length - 1];
    if (last && sameCity(last.city, stop.city)) {
      // Aynı şehirde art arda kalemler (uçuş + otel) tek durak olur.
      if (stop.depart_on && (!last.depart_on || stop.depart_on > last.depart_on)) last.depart_on = stop.depart_on;
      last.country_code ??= stop.country_code;
    } else {
      stops.push(stop);
    }
  }

  // Ayrılış tarihi bilinmeyen durak, bir sonraki durağa varışta veya seyahat sonunda biter.
  stops.forEach((stop, index) => {
    stop.depart_on ??= stops[index + 1]?.arrive_on ?? endDate;
  });

  const cities = [...new Map(stops.map((s) => [s.city.toLowerCase(), s.city])).values()];
  const title = cities.length ? cities.slice(0, 3).join(' · ') : items[0].title;

  return {
    title,
    start_date: startDate,
    end_date: endDate,
    destinations: stops,
    reservations: items.map(toReservation),
  };
}
