// translate-texts işlevinin saf yardımcıları (Deno ve istemci testleri için bağımsız).

export const MAX_TEXTS = 60;
export const MAX_TEXT_CHARS = 2000;

/** Metin listesini doğrular: dizi, en çok MAX_TEXTS öğe, hepsi dize; uzun metinler kırpılır. Geçersizse null. */
export function cleanTexts(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_TEXTS) return null;
  if (!value.every((v) => typeof v === 'string')) return null;
  return (value as string[]).map((v) => v.trim().slice(0, MAX_TEXT_CHARS));
}

/** Önbellek anahtarı: kırpılmış metnin SHA-256 özeti (hex). */
export async function textHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
