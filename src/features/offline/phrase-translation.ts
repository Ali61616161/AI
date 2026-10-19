// Cümle kitabının yerleşik 9 dilde olmayan diller için çeviri toplu isteği (arayüz bağımlılığı yok).
// Cümleler numaralı satırlar olarak tek seferde çevrilir; sonuç numarasına göre eşlenir.

export function buildBatch(texts: readonly string[]): string {
  return texts.map((t, i) => `${i + 1}| ${t.replace(/\s*\n\s*/g, ' ')}`).join('\n');
}

/** Çevrilmiş numaralı satırları sıraya geri koyar. Eksik ya da bozuksa null (kısmi sonuç kaydedilmez). */
export function parseBatch(translated: string, count: number): string[] | null {
  const out: string[] = new Array(count).fill('');
  for (const line of translated.split('\n')) {
    const m = line.match(/^\s*(\d{1,3})\s*[|.)：:]\s*(.+?)\s*$/);
    if (!m) continue;
    const n = Number(m[1]);
    if (n >= 1 && n <= count && !out[n - 1]) out[n - 1] = m[2];
  }
  return out.every((s) => s.length > 0) ? out : null;
}

/** Sağdan sola yazılan diller. */
export const RTL_LANGUAGES = ['ar', 'he', 'fa'] as const;
export const isRtlLanguage = (code: string) => (RTL_LANGUAGES as readonly string[]).includes(code.split('-')[0]);
