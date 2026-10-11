// Bilet ve otel bağlantıları. Ortaklık (affiliate) kimlikleri koda yazılmaz; her
// ortak için bir bağlantı şablonu sunucu ortam değişkeninden okunur. Şablon yoksa
// ortaklık kimliği olmayan düz arama bağlantısı kullanılır (bağlantı yine çalışır,
// sadece komisyon kazanılmaz).
//
// Ortam değişkenleri (isteğe bağlı):
//   AFFILIATE_BOOKING_URL       ör. https://www.booking.com/searchresults.html?ss={query}&checkin={checkin}&checkout={checkout}&group_adults={adults}&group_children={children}&lang={lang}&aid=123456
//   AFFILIATE_GETYOURGUIDE_URL  ör. https://www.getyourguide.com/s/?q={query}&partner_id=ABC123
//   AFFILIATE_TIQETS_URL        ör. https://www.tiqets.com/en/search/?q={query}&partner=yola
// Yer tutucular: {query} {city} {checkin} {checkout} {adults} {children} {lang}

export type AffiliatePartner = 'booking' | 'getyourguide' | 'tiqets';

export const DEFAULT_TEMPLATES: Record<AffiliatePartner, string> = {
  booking:
    'https://www.booking.com/searchresults.html?ss={query}&checkin={checkin}&checkout={checkout}&group_adults={adults}&group_children={children}&no_rooms=1&lang={lang}',
  getyourguide: 'https://www.getyourguide.com/s/?q={query}',
  tiqets: 'https://www.tiqets.com/en/search/?q={query}',
};

const ENV_NAMES: Record<AffiliatePartner, string> = {
  booking: 'AFFILIATE_BOOKING_URL',
  getyourguide: 'AFFILIATE_GETYOURGUIDE_URL',
  tiqets: 'AFFILIATE_TIQETS_URL',
};

export type AffiliateTemplates = Record<AffiliatePartner, string>;

/** Ortam değişkenlerinden şablonları okur; sadece https şablonlar kabul edilir. */
export function templatesFromEnv(get: (name: string) => string | undefined): AffiliateTemplates {
  const out = { ...DEFAULT_TEMPLATES };
  for (const partner of Object.keys(ENV_NAMES) as AffiliatePartner[]) {
    const value = get(ENV_NAMES[partner])?.trim();
    if (value && value.startsWith('https://') && value.includes('{query}')) out[partner] = value;
  }
  return out;
}

export type LinkValues = {
  query: string;
  city?: string | null;
  checkin?: string | null;
  checkout?: string | null;
  adults?: number | null;
  children?: number | null;
  lang?: string | null;
};

export function buildLink(template: string, values: LinkValues): string {
  const filled = template.replace(/\{(query|city|checkin|checkout|adults|children|lang)\}/g, (_, key: keyof LinkValues) => {
    const v = values[key];
    return v === null || v === undefined ? '' : encodeURIComponent(String(v));
  });
  // Değeri boş kalan parametreleri temizle (ör. tarihsiz otel araması).
  const url = new URL(filled);
  const params = new URLSearchParams([...url.searchParams.entries()].filter(([, v]) => v !== ''));
  url.search = params.toString();
  return url.toString();
}

export function hotelLink(templates: AffiliateTemplates, input: { name: string; city: string; checkin: string | null; checkout: string | null; adults: number; children: number; lang: string }): string {
  return buildLink(templates.booking, {
    query: `${input.name}, ${input.city}`,
    city: input.city,
    checkin: input.checkin,
    checkout: input.checkout,
    adults: input.adults,
    children: input.children,
    lang: input.lang,
  });
}

/** AI'ın "online bilet alınır" dediği duraklar için bilet bağlantısı. */
export function ticketLink(templates: AffiliateTemplates, partner: string | null, input: { title: string; placeName: string | null; city: string | null; lang: string }): string | null {
  if (partner !== 'getyourguide' && partner !== 'tiqets') return null;
  const name = input.placeName ?? input.title;
  return buildLink(templates[partner], { query: input.city && !name.includes(input.city) ? `${name} ${input.city}` : name, city: input.city, lang: input.lang });
}

/** Plan günlerindeki bilet ortaklı duraklara booking_url ekler (varsa dokunmaz). */
export function addTicketLinks<
  T extends { title: string; place_name: string | null; affiliate_partner: string | null; booking_url?: string | null },
  D extends { city: string | null; items: T[] },
>(days: D[], templates: AffiliateTemplates, lang: string): D[] {
  return days.map((day) => ({
    ...day,
    items: day.items.map((item) =>
      item.booking_url
        ? item
        : { ...item, booking_url: ticketLink(templates, item.affiliate_partner, { title: item.title, placeName: item.place_name, city: day.city, lang }) },
    ),
  }));
}
