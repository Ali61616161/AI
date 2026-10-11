// Çeviri merkezinde seçilebilen diller: kendi dillerindeki adlarıyla (her arayüz
// dilinde aynı görünür) ve konuşma tanıma / sesli okuma için yerel ayar koduyla.

export type TranslateLanguage = { code: string; name: string; speech: string };

export const TRANSLATE_LANGUAGES: TranslateLanguage[] = [
  { code: 'tr', name: 'Türkçe', speech: 'tr-TR' },
  { code: 'en', name: 'English', speech: 'en-US' },
  { code: 'es', name: 'Español', speech: 'es-ES' },
  { code: 'fr', name: 'Français', speech: 'fr-FR' },
  { code: 'de', name: 'Deutsch', speech: 'de-DE' },
  { code: 'it', name: 'Italiano', speech: 'it-IT' },
  { code: 'ru', name: 'Русский', speech: 'ru-RU' },
  { code: 'ar', name: 'العربية', speech: 'ar-SA' },
  { code: 'zh-CN', name: '中文 (简体)', speech: 'zh-CN' },
  { code: 'zh-TW', name: '中文 (繁體)', speech: 'zh-TW' },
  { code: 'ja', name: '日本語', speech: 'ja-JP' },
  { code: 'ko', name: '한국어', speech: 'ko-KR' },
  { code: 'pt', name: 'Português', speech: 'pt-PT' },
  { code: 'pt-BR', name: 'Português (Brasil)', speech: 'pt-BR' },
  { code: 'nl', name: 'Nederlands', speech: 'nl-NL' },
  { code: 'el', name: 'Ελληνικά', speech: 'el-GR' },
  { code: 'pl', name: 'Polski', speech: 'pl-PL' },
  { code: 'cs', name: 'Čeština', speech: 'cs-CZ' },
  { code: 'hu', name: 'Magyar', speech: 'hu-HU' },
  { code: 'ro', name: 'Română', speech: 'ro-RO' },
  { code: 'bg', name: 'Български', speech: 'bg-BG' },
  { code: 'hr', name: 'Hrvatski', speech: 'hr-HR' },
  { code: 'sr', name: 'Српски', speech: 'sr-RS' },
  { code: 'uk', name: 'Українська', speech: 'uk-UA' },
  { code: 'sv', name: 'Svenska', speech: 'sv-SE' },
  { code: 'no', name: 'Norsk', speech: 'nb-NO' },
  { code: 'da', name: 'Dansk', speech: 'da-DK' },
  { code: 'fi', name: 'Suomi', speech: 'fi-FI' },
  { code: 'he', name: 'עברית', speech: 'he-IL' },
  { code: 'fa', name: 'فارسی', speech: 'fa-IR' },
  { code: 'hi', name: 'हिन्दी', speech: 'hi-IN' },
  { code: 'th', name: 'ไทย', speech: 'th-TH' },
  { code: 'vi', name: 'Tiếng Việt', speech: 'vi-VN' },
  { code: 'id', name: 'Bahasa Indonesia', speech: 'id-ID' },
  { code: 'ms', name: 'Bahasa Melayu', speech: 'ms-MY' },
  { code: 'ka', name: 'ქართული', speech: 'ka-GE' },
  { code: 'az', name: 'Azərbaycan', speech: 'az-AZ' },
];

const BY_CODE = new Map(TRANSLATE_LANGUAGES.map((l) => [l.code, l]));

export function translateLanguage(code: string): TranslateLanguage {
  return BY_CODE.get(code) ?? BY_CODE.get(code.split('-')[0]) ?? { code, name: code, speech: code };
}

export const RTL_LANGUAGES = new Set(['ar', 'he', 'fa']);

/** Uygulama dilinden çeviri dili (zh → zh-CN). */
export function fromAppLanguage(code: string): string {
  return code === 'zh' ? 'zh-CN' : code;
}

/** Ülke koduna göre karşı tarafın muhtemel dili. */
const COUNTRY: Record<string, string> = {
  TR: 'tr', GB: 'en', US: 'en', IE: 'en', AU: 'en', CA: 'en', ES: 'es', MX: 'es', AR: 'es', FR: 'fr', BE: 'fr', DE: 'de', AT: 'de', CH: 'de',
  IT: 'it', RU: 'ru', SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', JO: 'ar', QA: 'ar', CN: 'zh-CN', TW: 'zh-TW', HK: 'zh-TW', JP: 'ja', KR: 'ko',
  PT: 'pt', BR: 'pt-BR', NL: 'nl', GR: 'el', CY: 'el', PL: 'pl', CZ: 'cs', HU: 'hu', RO: 'ro', BG: 'bg', HR: 'hr', RS: 'sr', UA: 'uk',
  SE: 'sv', NO: 'no', DK: 'da', FI: 'fi', IL: 'he', IR: 'fa', IN: 'hi', TH: 'th', VN: 'vi', ID: 'id', MY: 'ms', GE: 'ka', AZ: 'az',
};

export function languageForCountry(countryCode: string | null | undefined): string | null {
  return countryCode ? (COUNTRY[countryCode.toUpperCase()] ?? null) : null;
}
