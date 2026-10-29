import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import { DevSettings, I18nManager, Platform } from 'react-native';

import ar from './locales/ar.json';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ru from './locales/ru.json';
import tr from './locales/tr.json';
import zh from './locales/zh.json';
import pt from './locales/pt.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import nl from './locales/nl.json';
import pl from './locales/pl.json';
import hi from './locales/hi.json';
import id from './locales/id.json';
import { FALLBACK_LANGUAGE, isRTL, isSupportedLanguage, type LanguageCode } from './languages';

export const resources = {
  tr: { translation: tr },
  en: { translation: en },
  es: { translation: es },
  fr: { translation: fr },
  de: { translation: de },
  it: { translation: it },
  ru: { translation: ru },
  ar: { translation: ar },
  zh: { translation: zh },
  pt: { translation: pt },
  ja: { translation: ja },
  ko: { translation: ko },
  nl: { translation: nl },
  pl: { translation: pl },
  hi: { translation: hi },
  id: { translation: id },
} as const;

// Uygulamaya özel bir i18next örneği; global varsayılan örnekle karışmaz.
// eslint-disable-next-line import/no-named-as-default-member
const i18n = i18next.createInstance();

const STORAGE_KEY = 'yola.language';

/**
 * Cihazın tercih ettiği diller sırayla denenir (ör. [de-CH, en-US] → de); hiçbiri
 * desteklenmiyorsa İngilizce. Dil sonradan Profil → Dil'den değiştirilebilir.
 */
function detectDeviceLanguage(): LanguageCode {
  for (const locale of getLocales()) {
    const code = locale.languageCode?.toLowerCase();
    if (isSupportedLanguage(code)) return code;
  }
  return FALLBACK_LANGUAGE;
}

async function readStoredLanguage(): Promise<LanguageCode | null> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    return isSupportedLanguage(stored) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Yazı yönü dil ile uyuşmuyorsa düzeltir ve yeniden başlatma gerekiyorsa true döner.
 * Telefonda yön değişikliği yeniden başlatmadan sonra etkili olur; web'de sayfanın
 * dir özelliği anında değiştirilir.
 */
function applyDirection(language: LanguageCode): boolean {
  const shouldBeRTL = isRTL(language);
  if (Platform.OS === 'web') {
    if (typeof document !== 'undefined') {
      document.documentElement.dir = shouldBeRTL ? 'rtl' : 'ltr';
      document.documentElement.lang = language;
    }
    return false;
  }
  I18nManager.allowRTL(shouldBeRTL);
  if (I18nManager.isRTL !== shouldBeRTL) {
    I18nManager.forceRTL(shouldBeRTL);
    return true;
  }
  return false;
}

export async function initI18n(): Promise<void> {
  const language = (await readStoredLanguage()) ?? detectDeviceLanguage();
  applyDirection(language);

  await i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: FALLBACK_LANGUAGE,
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}

/**
 * Dili değiştirir ve kaydeder. Yazı yönü değiştiyse (ör. Arapça ↔ diğerleri)
 * `true` döner; arayüz bu durumda kullanıcıya yeniden başlatmayı sormalıdır.
 */
export async function changeLanguage(language: LanguageCode): Promise<{ needsRestart: boolean }> {
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Kayıt başarısız olsa da dil bu oturum için değişti.
  }
  return { needsRestart: applyDirection(language) };
}

export function restartApp(): void {
  DevSettings.reload();
}

export function currentLanguage(): LanguageCode {
  return isSupportedLanguage(i18n.language) ? i18n.language : FALLBACK_LANGUAGE;
}

export default i18n;
