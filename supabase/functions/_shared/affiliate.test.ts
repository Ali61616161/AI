import { assertEquals } from 'jsr:@std/assert@1';

import { addTicketLinks, buildLink, DEFAULT_TEMPLATES, hotelLink, templatesFromEnv, ticketLink } from './affiliate.ts';

Deno.test('templatesFromEnv: sadece https ve {query} içeren şablonları kabul eder', () => {
  const env: Record<string, string> = {
    AFFILIATE_BOOKING_URL: 'https://www.booking.com/searchresults.html?ss={query}&aid=123',
    AFFILIATE_GETYOURGUIDE_URL: 'http://evil.example/?q={query}',
    AFFILIATE_TIQETS_URL: 'https://www.tiqets.com/en/search/?partner=yola',
  };
  const t = templatesFromEnv((n) => env[n]);
  assertEquals(t.booking, env.AFFILIATE_BOOKING_URL);
  assertEquals(t.getyourguide, DEFAULT_TEMPLATES.getyourguide);
  assertEquals(t.tiqets, DEFAULT_TEMPLATES.tiqets);
});

Deno.test('buildLink: değerleri kodlar, boş kalan parametreleri siler', () => {
  assertEquals(
    buildLink('https://x.test/s?q={query}&in={checkin}&aid=9', { query: 'Hotel & Spa, Roma' }),
    'https://x.test/s?q=Hotel+%26+Spa%2C+Roma&aid=9',
  );
});

Deno.test('hotelLink: Booking aramasına tarih ve kişi sayısını ekler', () => {
  const url = new URL(
    hotelLink(templatesFromEnv(() => undefined), { name: 'Hotel Artemide', city: 'Roma', checkin: '2026-10-20', checkout: '2026-10-23', adults: 2, children: 1, lang: 'tr' }),
  );
  assertEquals(url.hostname, 'www.booking.com');
  assertEquals(url.searchParams.get('ss'), 'Hotel Artemide, Roma');
  assertEquals(url.searchParams.get('checkin'), '2026-10-20');
  assertEquals(url.searchParams.get('group_adults'), '2');
  assertEquals(url.searchParams.get('group_children'), '1');
});

Deno.test('ticketLink ve addTicketLinks: sadece bilet ortaklı duraklara bağlantı ekler', () => {
  const t = templatesFromEnv((n) => (n === 'AFFILIATE_GETYOURGUIDE_URL' ? 'https://www.getyourguide.com/s/?q={query}&partner_id=P1' : undefined));
  assertEquals(ticketLink(t, 'getyourguide', { title: 'Kolezyum turu', placeName: 'Colosseo', city: 'Roma', lang: 'tr' }), 'https://www.getyourguide.com/s/?q=Colosseo+Roma&partner_id=P1');
  assertEquals(ticketLink(t, null, { title: 'x', placeName: null, city: null, lang: 'tr' }), null);
  const days = addTicketLinks(
    [{ city: 'Roma', items: [
      { title: 'Vatikan', place_name: 'Musei Vaticani', affiliate_partner: 'tiqets', booking_url: null as string | null },
      { title: 'Öğle', place_name: null, affiliate_partner: null },
      { title: 'Var', place_name: null, affiliate_partner: 'tiqets', booking_url: 'https://keep.test/' },
    ] }],
    t,
    'tr',
  );
  assertEquals(days[0].items.map((i) => i.booking_url), ['https://www.tiqets.com/en/search/?q=Musei+Vaticani+Roma', null, 'https://keep.test/']);
});
