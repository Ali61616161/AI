// Bavul listesindeki eşyalar için alışveriş bağlantıları (Amazon arama sayfası). Ortaklık kimlikleri koda yazılmaz: mağaza
// ülkesine göre sunucudan gelir (affiliate-config); kimlik yoksa düz arama bağlantısı açılır (çalışır, komisyon kazandırmaz).

/** Amazon mağaza alan adları (ülke kodu → alan adı). */
export const AMAZON_DOMAINS: Record<string, string> = {
  TR: 'amazon.com.tr',
  US: 'amazon.com',
  GB: 'amazon.co.uk',
  DE: 'amazon.de',
  FR: 'amazon.fr',
  IT: 'amazon.it',
  ES: 'amazon.es',
  NL: 'amazon.nl',
  SE: 'amazon.se',
  PL: 'amazon.pl',
  BE: 'amazon.com.be',
  IE: 'amazon.ie',
  CA: 'amazon.ca',
  AU: 'amazon.com.au',
  JP: 'amazon.co.jp',
  IN: 'amazon.in',
  AE: 'amazon.ae',
  SA: 'amazon.sa',
  EG: 'amazon.eg',
  BR: 'amazon.com.br',
  MX: 'amazon.com.mx',
  SG: 'amazon.sg',
};

const LANGUAGE_STORE: Record<string, string> = { tr: 'TR', de: 'DE', fr: 'FR', it: 'IT', es: 'ES', ar: 'AE', en: 'US', ru: 'US', zh: 'US' };

/**
 * Kullanıcının alışveriş yapacağı mağaza: önce yaşadığı ülke (eşyalar seyahatten önce evde alınır), o ülkede Amazon
 * yoksa uygulama dilinin mağazası, o da yoksa amazon.com.
 */
export function amazonStore(homeCountry: string | null | undefined, language: string): string {
  const code = homeCountry?.toUpperCase() ?? '';
  if (AMAZON_DOMAINS[code]) return code;
  return LANGUAGE_STORE[language] ?? 'US';
}

export function shopUrl(query: string, options: { homeCountry?: string | null; language: string; tags?: Record<string, string> }): string {
  const store = amazonStore(options.homeCountry, options.language);
  const tag = options.tags?.[store];
  const q = encodeURIComponent(query.trim().slice(0, 100));
  return `https://www.${AMAZON_DOMAINS[store]}/s?k=${q}${tag ? `&tag=${encodeURIComponent(tag)}` : ''}`;
}

/** Satın alınabilecek öneri anahtarları (belge, otel gibi şeyler hariç). */
export const SHOPPABLE_KEYS: ReadonlySet<string> = new Set([
  'walkingShoes', 'warmJacket', 'hatGloves', 'thermals', 'lightJacket', 'shorts', 'sunglasses', 'sunscreen', 'hat', 'umbrella', 'swimwear', 'beachTowel',
  'toiletriesBag', 'firstAid', 'phoneCharger', 'powerBank', 'plugAdapter', 'headphones', 'reusableBottle', 'daypack', 'hikingShoes', 'kidsEntertainment',
]);
