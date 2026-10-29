import languages from './languages.json';

/** Desteklenen diller. Liste languages.json dosyasındadır, app.config.ts de oradan okur. */
export const LANGUAGE_CODES = ['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh', 'pt', 'ja', 'ko', 'nl', 'pl', 'hi', 'id'] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export type Language = { code: LanguageCode; nativeName: string; rtl: boolean };

export const SUPPORTED_LANGUAGES = languages as Language[];

export const FALLBACK_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return LANGUAGE_CODES.some((c) => c === code);
}

export function isRTL(code: LanguageCode): boolean {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.rtl ?? false;
}
