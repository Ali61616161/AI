// eSIM (mobil veri paketi) sağlayıcı bağlantıları. Ortaklık kimlikleri koda yazılmaz: her sağlayıcı için
// isteğe bağlı bir EXPO_PUBLIC_AFFILIATE_<SAĞLAYICI> şablonu verilirse hedef adres `{url}` yerine konur
// (ör. https://airalo.pxf.io/c/123/456/789?u={url}). Şablon yoksa düz sağlayıcı sayfası açılır.
import { englishCountryName } from '../tools/countries.ts';

export type EsimProvider = 'airalo' | 'holafly' | 'saily';
export const ESIM_PROVIDERS: EsimProvider[] = ['airalo', 'holafly', 'saily'];
export const ESIM_NAMES: Record<EsimProvider, string> = { airalo: 'Airalo', holafly: 'Holafly', saily: 'Saily' };

/** Sağlayıcı sitelerinde farklı yazılan ülkeler (kod → adres parçası). */
const SLUG_OVERRIDES: Record<string, string> = { TR: 'turkey', CZ: 'czech-republic', CD: 'dr-congo', CG: 'congo' };

export function esimSlug(countryCode: string): string | null {
  const code = countryCode.toUpperCase();
  if (SLUG_OVERRIDES[code]) return SLUG_OVERRIDES[code];
  const slug = englishCountryName(code)
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/\(.*?\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug && englishCountryName(code) !== code ? slug : null;
}

export type EsimTemplates = Partial<Record<EsimProvider, string>>;

export function plainUrl(provider: EsimProvider, countryCode: string): string {
  const slug = esimSlug(countryCode);
  switch (provider) {
    case 'airalo':
      return slug ? `https://www.airalo.com/${slug}-esim` : 'https://www.airalo.com/';
    case 'holafly':
      return slug ? `https://esim.holafly.com/esim-${slug}/` : 'https://esim.holafly.com/';
    case 'saily':
      return slug ? `https://saily.com/esim-${slug}/` : 'https://saily.com/';
  }
}

export type EsimOption = { provider: EsimProvider; url: string; affiliate: boolean };

/** Ülke için sağlayıcı bağlantıları; şablonu olan sağlayıcıların bağlantısı ortaklık adresi olur. */
export function esimOptions(countryCode: string, templates: EsimTemplates = {}): EsimOption[] {
  return ESIM_PROVIDERS.map((provider) => {
    const target = plainUrl(provider, countryCode);
    const template = templates[provider];
    const usable = template?.startsWith('https://') && template.includes('{url}');
    return { provider, url: usable ? template!.replace('{url}', encodeURIComponent(target)) : target, affiliate: Boolean(usable) };
  });
}

export function templatesFromPublicEnv(env: Record<string, string | undefined>): EsimTemplates {
  return {
    airalo: env.EXPO_PUBLIC_AFFILIATE_AIRALO,
    holafly: env.EXPO_PUBLIC_AFFILIATE_HOLAFLY,
    saily: env.EXPO_PUBLIC_AFFILIATE_SAILY,
  };
}
