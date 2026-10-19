// Hesap silme gibi geri alınamaz işlemlerde, erişim anahtarının yakın zamanda (şifre ya da
// e-posta kodu ile) alınmış olmasını ister. Anahtarın "iat" (verilme zamanı) alanına bakılır.

export const FRESH_LOGIN_SECONDS = 10 * 60;

/** Bearer anahtarının verilme zamanı (saniye); okunamazsa null. İmza doğrulaması Supabase'e aittir. */
export function tokenIssuedAt(authorization: string | null): number | null {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    const iat = JSON.parse(json)?.iat;
    return typeof iat === 'number' && Number.isFinite(iat) ? iat : null;
  } catch {
    return null;
  }
}

export function isFreshLogin(authorization: string | null, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const iat = tokenIssuedAt(authorization);
  return iat !== null && nowSeconds - iat <= FRESH_LOGIN_SECONDS && nowSeconds - iat >= -60;
}
