// Ortaklık (affiliate) ayarları sunucudan verilir: ortaklık onayı gelince yalnızca Supabase sırrı eklenir, uygulamayı
// yeniden derlemek gerekmez. Burada yalnızca doğrulanmış, herkese açık bağlantı şablonları ve kimlikler dönülür.
//
// Sırlar (hepsi isteğe bağlı):
//   AFFILIATE_ESIM_AIRALO_URL, AFFILIATE_ESIM_HOLAFLY_URL, AFFILIATE_ESIM_SAILY_URL
//       https:// ile başlayan, hedef adres yerine {url} içeren şablon (ör. https://airalo.pxf.io/c/123/456/789?u={url})
//   AFFILIATE_AMAZON_TAGS
//       Mağaza ülkesine göre Amazon Associates kimlikleri, JSON: {"TR":"yola-21","DE":"yola0d-21","US":"yola-20"}

export type AffiliateConfig = {
  esim: { airalo?: string; holafly?: string; saily?: string };
  amazon: Record<string, string>;
};

const ESIM_ENV = { airalo: 'AFFILIATE_ESIM_AIRALO_URL', holafly: 'AFFILIATE_ESIM_HOLAFLY_URL', saily: 'AFFILIATE_ESIM_SAILY_URL' } as const;

/** Geçerli eSIM şablonu: https ve {url} yer tutucusu içerir. */
export function validEsimTemplate(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 600 && value.startsWith('https://') && value.includes('{url}');
}

/** Amazon kimlikleri: ülke kodu → kimlik. Geçersiz giriş sessizce atlanır. */
export function parseAmazonTags(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const data = JSON.parse(raw) as unknown;
    if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
    const out: Record<string, string> = {};
    for (const [country, tag] of Object.entries(data as Record<string, unknown>)) {
      if (/^[A-Z]{2}$/.test(country) && typeof tag === 'string' && /^[A-Za-z0-9-]{3,40}$/.test(tag)) out[country] = tag;
    }
    return out;
  } catch {
    return {};
  }
}

export function readAffiliateConfig(get: (name: string) => string | undefined): AffiliateConfig {
  const esim: AffiliateConfig['esim'] = {};
  for (const [provider, name] of Object.entries(ESIM_ENV) as [keyof typeof ESIM_ENV, string][]) {
    const value = get(name)?.trim();
    if (validEsimTemplate(value)) esim[provider] = value;
  }
  return { esim, amazon: parseAmazonTags(get('AFFILIATE_AMAZON_TAGS')) };
}
