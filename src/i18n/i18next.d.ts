import 'i18next';

import type en from './locales/en.json';

// Çeviri anahtarlarını tip güvenli yapar: t('welcome.title') otomatik tamamlanır,
// olmayan bir anahtar derleme hatası verir. İngilizce dosya referans alınır.
declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: typeof en };
    returnNull: false;
  }
}
