// Ses önbelleği sınırı: toplam boyut sınırı aşılırsa en eski dosyalar silinir. Saf mantık; testlenebilir.

export type CachedFile = { uri: string; size: number; modified: number };

/** Önbelleğin tamamı */
export const TTS_CACHE_MAX_BYTES = 50 * 1024 * 1024;

/** Toplam boyut `maxBytes` altına inene kadar en eskiden başlayarak silinecek dosyalar. */
export function filesToDelete(files: CachedFile[], maxBytes = TTS_CACHE_MAX_BYTES): CachedFile[] {
  let total = files.reduce((sum, f) => sum + f.size, 0);
  if (total <= maxBytes) return [];
  const out: CachedFile[] = [];
  for (const f of [...files].sort((a, b) => a.modified - b.modified)) {
    if (total <= maxBytes) break;
    out.push(f);
    total -= f.size;
  }
  return out;
}
