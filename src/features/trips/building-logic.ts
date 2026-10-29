// "Seyahatiniz oluşturuluyor" ekranının saf mantığı (testlenebilir).

/** Başarılı üretimde bile ekran en az bu kadar (ms) açık kalır; işin özenle yapıldığı hissi verir. */
export const MIN_BUILD_MS = 10_000;

/** Üretim bittiğinde ekranın kalması gereken ek süre (ms). Hata olduysa beklenmez. */
export function remainingHoldMs(startedAt: number, now: number, failed: boolean, minMs = MIN_BUILD_MS): number {
  if (failed) return 0;
  return Math.max(0, minMs - (now - startedAt));
}

/** Geçen süreye göre görünen adım sırası (her adım `stepMs` sürer; son adımda kalır). */
export function stepIndex(elapsedMs: number, steps: number, stepMs = 4_000): number {
  return Math.min(Math.max(Math.floor(elapsedMs / stepMs), 0), steps - 1);
}

/** Sahte ama dürüst ilerleme: ilk 10 sn'de ~%60, sonra yavaşlayarak en çok %92'ye yaklaşır. */
export function progressFraction(elapsedMs: number): number {
  const t = Math.max(elapsedMs, 0) / 1000;
  return Math.min(0.92, 1 - Math.exp(-t / 18));
}

const ERROR_CODES = ['quota_exceeded', 'ai_failed', 'not_configured', 'no_dates', 'network'] as const;
export type BuildErrorCode = (typeof ERROR_CODES)[number];
export const asBuildError = (v: unknown): BuildErrorCode | null => (typeof v === 'string' && (ERROR_CODES as readonly string[]).includes(v) ? (v as BuildErrorCode) : null);
