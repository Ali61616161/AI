import * as Sentry from '@sentry/react-native';
import { Platform } from 'react-native';

/**
 * Çökme ve hata izleme (Sentry). Yalnızca EXPO_PUBLIC_SENTRY_DSN tanımlıysa ve geliştirme modunda değilse çalışır;
 * yoksa hiçbir şey yapmaz. Kişisel veri gönderilmez (e-posta, IP, istek gövdeleri kapalı); performans izleme kapalıdır,
 * ücretsiz kotayı yalnızca hatalar kullanır.
 */
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;
export const monitoringEnabled = Boolean(DSN) && !__DEV__ && Platform.OS !== 'web';

export function initMonitoring(): void {
  if (!monitoringEnabled) return;
  Sentry.init({
    dsn: DSN,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    beforeSend(event) {
      // Konum, belge, mesaj gibi içerik hata olay metnine sızmasın: kullanıcı ve istek ayrıntıları atılır.
      delete event.user;
      delete event.request;
      return event;
    },
  });
}

/** Kök bileşeni Sentry ile sarar (yakalanmamış arayüz hataları raporlanır); kapalıysa bileşen aynen döner. */
export function withMonitoring<T extends React.ComponentType<never>>(component: T): T {
  return monitoringEnabled ? (Sentry.wrap(component as React.ComponentType<Record<string, unknown>>) as unknown as T) : component;
}

/** Yakalanmış ama izlenmesi gereken hata (ör. beklenmedik sunucu yanıtı). Kapalıyken yok sayılır. */
export function reportError(error: unknown, context?: string): void {
  if (!monitoringEnabled) return;
  Sentry.captureException(error, context ? { tags: { context } } : undefined);
}
