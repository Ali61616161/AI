// Uygulamanın desteklediği arayüz dilleri (src/i18n/languages.json ile aynı liste; testle denetlenir).
export const SUPPORTED_LANGUAGES = ['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh', 'pt', 'ja', 'ko', 'nl', 'pl', 'hi', 'id'] as const;

export const SUPPORTED_LANGUAGE_SET: ReadonlySet<string> = new Set(SUPPORTED_LANGUAGES);
