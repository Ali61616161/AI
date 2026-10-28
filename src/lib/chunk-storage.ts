// Büyük değerleri (Supabase oturumu birkaç KB olabilir) Keychain'e sığacak parçalara böler. Saf mantık; testlenebilir.

/** Bir parçanın en fazla uzunluğu (SecureStore değer sınırının altında kalır). */
export const CHUNK_SIZE = 1800;

export function splitChunks(value: string, size = CHUNK_SIZE): string[] {
  if (value.length === 0) return [''];
  const parts: string[] = [];
  for (let i = 0; i < value.length; i += size) parts.push(value.slice(i, i + size));
  return parts;
}

/** Parçaları birleştirir; sayı tutmuyor ya da bir parça eksikse null (bozuk kayıt "yok" sayılır). */
export function joinChunks(count: number, read: (index: number) => string | null): string | null {
  if (!Number.isInteger(count) || count < 1 || count > 64) return null;
  let out = '';
  for (let i = 0; i < count; i++) {
    const part = read(i);
    if (part === null) return null;
    out += part;
  }
  return out;
}

/** SecureStore anahtarı yalnızca harf, rakam, ".", "-" ve "_" içerebilir. */
export const safeKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');
