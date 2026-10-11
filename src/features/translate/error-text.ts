import { TranslateError } from './api';

/** Hata nesnesinden çeviri anahtarı. */
export function translateErrorKey(error: unknown) {
  const code = error instanceof TranslateError ? error.code : 'network';
  return `translate.errors.${code}` as const;
}
