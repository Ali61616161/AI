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
  { code: 'af', name: 'Afrikaans', speech: 'af-ZA' },
  { code: 'sq', name: 'Shqip', speech: 'sq-AL' },
  { code: 'am', name: 'አማርኛ', speech: 'am-ET' },
  { code: 'hy', name: 'Հայերեն', speech: 'hy-AM' },
  { code: 'eu', name: 'Euskara', speech: 'eu-ES' },
  { code: 'be', name: 'Беларуская', speech: 'be-BY' },
  { code: 'bn', name: 'বাংলা', speech: 'bn-BD' },
  { code: 'bs', name: 'Bosanski', speech: 'bs-BA' },
  { code: 'my', name: 'မြန်မာဘာသာ', speech: 'my-MM' },
  { code: 'ca', name: 'Català', speech: 'ca-ES' },
  { code: 'et', name: 'Eesti', speech: 'et-EE' },
  { code: 'fil', name: 'Filipino', speech: 'fil-PH' },
  { code: 'gl', name: 'Galego', speech: 'gl-ES' },
  { code: 'gu', name: 'ગુજરાતી', speech: 'gu-IN' },
  { code: 'is', name: 'Íslenska', speech: 'is-IS' },
  { code: 'ga', name: 'Gaeilge', speech: 'ga-IE' },
  { code: 'jv', name: 'Basa Jawa', speech: 'jv-ID' },
  { code: 'kn', name: 'ಕನ್ನಡ', speech: 'kn-IN' },
  { code: 'kk', name: 'Қазақша', speech: 'kk-KZ' },
  { code: 'km', name: 'ខ្មែរ', speech: 'km-KH' },
  { code: 'ku', name: 'Kurdî', speech: 'ku-TR' },
  { code: 'ky', name: 'Кыргызча', speech: 'ky-KG' },
  { code: 'lo', name: 'ລາວ', speech: 'lo-LA' },
  { code: 'lv', name: 'Latviešu', speech: 'lv-LV' },
  { code: 'lt', name: 'Lietuvių', speech: 'lt-LT' },
  { code: 'lb', name: 'Lëtzebuergesch', speech: 'lb-LU' },
  { code: 'mk', name: 'Македонски', speech: 'mk-MK' },
  { code: 'mg', name: 'Malagasy', speech: 'mg-MG' },
  { code: 'ml', name: 'മലയാളം', speech: 'ml-IN' },
  { code: 'mt', name: 'Malti', speech: 'mt-MT' },
  { code: 'mi', name: 'Te Reo Māori', speech: 'mi-NZ' },
  { code: 'mr', name: 'मराठी', speech: 'mr-IN' },
  { code: 'mn', name: 'Монгол', speech: 'mn-MN' },
  { code: 'ne', name: 'नेपाली', speech: 'ne-NP' },
  { code: 'ps', name: 'پښتو', speech: 'ps-AF' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ', speech: 'pa-IN' },
  { code: 'sm', name: 'Gagana Sāmoa', speech: 'sm-WS' },
  { code: 'gd', name: 'Gàidhlig', speech: 'gd-GB' },
  { code: 'sn', name: 'chiShona', speech: 'sn-ZW' },
  { code: 'sd', name: 'سنڌي', speech: 'sd-PK' },
  { code: 'si', name: 'සිංහල', speech: 'si-LK' },
  { code: 'sk', name: 'Slovenčina', speech: 'sk-SK' },
  { code: 'sl', name: 'Slovenščina', speech: 'sl-SI' },
  { code: 'so', name: 'Soomaali', speech: 'so-SO' },
  { code: 'sw', name: 'Kiswahili', speech: 'sw-KE' },
  { code: 'ta', name: 'தமிழ்', speech: 'ta-IN' },
  { code: 'tg', name: 'Тоҷикӣ', speech: 'tg-TJ' },
  { code: 'te', name: 'తెలుగు', speech: 'te-IN' },
  { code: 'tk', name: 'Türkmençe', speech: 'tk-TM' },
  { code: 'ur', name: 'اردو', speech: 'ur-PK' },
  { code: 'ug', name: 'ئۇيغۇرچە', speech: 'ug-CN' },
  { code: 'uz', name: 'Oʻzbekcha', speech: 'uz-UZ' },
  { code: 'cy', name: 'Cymraeg', speech: 'cy-GB' },
  { code: 'xh', name: 'isiXhosa', speech: 'xh-ZA' },
  { code: 'yo', name: 'Yorùbá', speech: 'yo-NG' },
  { code: 'zu', name: 'isiZulu', speech: 'zu-ZA' },
  { code: 'ha', name: 'Hausa', speech: 'ha-NG' },
  { code: 'ig', name: 'Igbo', speech: 'ig-NG' },
  { code: 'ht', name: 'Kreyòl ayisyen', speech: 'ht-HT' },
  { code: 'eo', name: 'Esperanto', speech: 'eo' },
  { code: 'lg', name: 'Luganda', speech: 'lg-UG' },
  { code: 'rw', name: 'Kinyarwanda', speech: 'rw-RW' },
  { code: 'ny', name: 'Chichewa', speech: 'ny-MW' },
  { code: 'st', name: 'Sesotho', speech: 'st-LS' },
  { code: 'co', name: 'Corsu', speech: 'co-FR' },
  { code: 'fy', name: 'Frysk', speech: 'fy-NL' },
  { code: 'haw', name: 'ʻŌlelo Hawaiʻi', speech: 'haw-US' },
  { code: 'yi', name: 'ייִדיש', speech: 'yi' },
  { code: 'ckb', name: 'کوردی (سۆرانی)', speech: 'ckb-IQ' },
  { code: 'dv', name: 'ދިވެހި', speech: 'dv-MV' },
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
  AL: 'sq', AM: 'hy', AF: 'ps', BA: 'bs', BD: 'bn', BY: 'be', KZ: 'kk', KG: 'ky', UZ: 'uz', TJ: 'tg', TM: 'tk', MN: 'mn', NP: 'ne', LK: 'si',
  PK: 'ur', MM: 'my', KH: 'km', LA: 'lo', PH: 'fil', EE: 'et', LV: 'lv', LT: 'lt', SK: 'sk', SI: 'sl', MK: 'mk', MT: 'mt', IS: 'is', LU: 'lb',
  KE: 'sw', TZ: 'sw', ET: 'am', NG: 'ha', ZA: 'zu', RW: 'rw', SO: 'so', MG: 'mg', MU: 'fr', HT: 'ht', WS: 'sm', NZ: 'en', SG: 'en',
  CL: 'es', CO: 'es', PE: 'es', VE: 'es', EC: 'es', UY: 'es', CR: 'es', PA: 'es', DO: 'es', CU: 'es', GT: 'es', BO: 'es', PY: 'es',
  TN: 'ar', DZ: 'ar', LB: 'ar', IQ: 'ar', KW: 'ar', OM: 'ar', BH: 'ar', LY: 'ar', SD: 'ar', SY: 'ar', YE: 'ar',
};

export function languageForCountry(countryCode: string | null | undefined): string | null {
  return countryCode ? (COUNTRY[countryCode.toUpperCase()] ?? null) : null;
}
