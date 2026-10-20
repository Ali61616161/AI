// Hesap silme gibi geri alınamaz işlemlerde, kullanıcının yakın zamanda şifre ya da e-posta kodu
// girdiğini ister. Erişim anahtarının "iat" alanı her yenilemede tazelendiği için güvenilmez;
// bunun yerine anahtardaki "amr" (kimlik doğrulama yöntemleri) kayıtlarının zamanına bakılır.

export const FRESH_LOGIN_SECONDS = 10 * 60;

/** Kullanıcının kendisinin girdiği doğrulama yöntemleri (sosyal giriş ve yenileme sayılmaz). */
const INTERACTIVE_METHODS = new Set(['password', 'otp', 'magiclink', 'email/signup', 'recovery', 'oauth', 'id_token']);

function claims(authorization: string | null): Record<string, unknown> | null {
  const token = authorization?.replace(/^Bearer\s+/i, '');
  const payload = token?.split('.')[1];
  if (!payload) return null;
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '='));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** Anahtardaki en yeni etkileşimli doğrulamanın zamanı (saniye); yoksa null. İmza doğrulaması Supabase'e aittir. */
export function authenticatedAt(authorization: string | null): number | null {
  const amr = claims(authorization)?.amr;
  if (!Array.isArray(amr)) return null;
  let latest: number | null = null;
  for (const entry of amr) {
    const method = typeof entry?.method === 'string' ? entry.method : null;
    const ts = typeof entry?.timestamp === 'number' && Number.isFinite(entry.timestamp) ? entry.timestamp : null;
    if (method && ts !== null && INTERACTIVE_METHODS.has(method) && (latest === null || ts > latest)) latest = ts;
  }
  return latest;
}

export function isFreshLogin(authorization: string | null, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  const at = authenticatedAt(authorization);
  return at !== null && nowSeconds - at <= FRESH_LOGIN_SECONDS && nowSeconds - at >= -60;
}
