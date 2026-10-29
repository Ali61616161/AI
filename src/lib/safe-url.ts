// Dışarıdan (sunucu, yapay zekâ, bağlantı parametresi) gelen adresleri açmadan önce denetler.
// Saf mantık: arayüz bağımlılığı yok, Deno testleri içe aktarır.

/** Yalnızca https:// adresleri (javascript:, intent:, file: vb. açılmaz). */
export function isHttpsUrl(url: unknown): url is string {
  if (typeof url !== 'string' || !/^https:\/\//i.test(url)) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

const GOOGLE_MAPS_HOSTS = /^(www\.)?(google\.[a-z.]{2,6}|maps\.google\.[a-z.]{2,6}|maps\.app\.goo\.gl|goo\.gl)$/i;

/** Google Haritalar adresi mi (bağlantıyla gelen "Google Haritalar'da aç" başka siteye gitmesin). */
export function isGoogleMapsUrl(url: unknown): url is string {
  if (!isHttpsUrl(url)) return false;
  const u = new URL(url);
  return GOOGLE_MAPS_HOSTS.test(u.hostname) && (u.hostname.includes('maps') || u.hostname.includes('goo.gl') || u.pathname.startsWith('/maps'));
}

/** Bildirimden açılabilecek uygulama yolları (başka ekranlara ya da dış adreslere yönlenmez). */
export function isAllowedNotificationPath(path: unknown): path is string {
  return typeof path === 'string' && /^\/(trip\/[0-9a-f-]{36}|trip-live\?tripId=[0-9a-f-]{36}(&day=\d+)?|trip-ended\?tripId=[0-9a-f-]{36}|price-watch)$/i.test(path);
}

/** Fırsat bağlantısı: yalnızca bilet sitesi (Aviasales); sunucudan gelen adres başka siteye gitmesin. */
export function isDealUrl(url: unknown): url is string {
  if (!isHttpsUrl(url)) return false;
  const host = new URL(url).hostname.toLowerCase();
  return host === 'aviasales.com' || host.endsWith('.aviasales.com');
}
