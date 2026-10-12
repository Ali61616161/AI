// AdMob ödüllü reklam sunucu doğrulaması (SSV). Google, kullanıcı ödülü kazanınca
// bu fonksiyonu imzalı bir GET isteğiyle çağırır. İmza ECDSA P-256 / SHA-256'dır;
// imzalanan mesaj sorgu dizgesinin "&signature=" öncesindeki kısmıdır. Anahtarlar
// https://www.gstatic.com/admob/reward/verifier-keys.json adresinde yayınlanır.

export const VERIFIER_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';

export type VerifierKey = { keyId: number; base64: string };

const b64ToBytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const b64UrlToBytes = (s: string) => b64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));

/** DER (ASN.1) kodlu ECDSA imzasını WebCrypto'nun beklediği r||s (64 bayt) biçimine çevirir. */
export function derToP1363(der: Uint8Array, size = 32): Uint8Array<ArrayBuffer> {
  if (der[0] !== 0x30) throw new Error('not a DER sequence');
  let i = 2;
  if (der[1] & 0x80) i = 2 + (der[1] & 0x7f);
  const readInt = () => {
    if (der[i] !== 0x02) throw new Error('expected integer');
    const len = der[i + 1];
    let bytes = der.slice(i + 2, i + 2 + len);
    i += 2 + len;
    while (bytes.length > size && bytes[0] === 0) bytes = bytes.slice(1);
    if (bytes.length > size) throw new Error('integer too long');
    const out = new Uint8Array(new ArrayBuffer(size));
    out.set(bytes, size - bytes.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const out = new Uint8Array(new ArrayBuffer(size * 2));
  out.set(r, 0);
  out.set(s, size);
  return out;
}

export type SsvPayload = {
  userId: string | null;
  customData: string | null;
  transactionId: string;
  keyId: number;
  timestamp: number;
};

/**
 * İsteğin sorgu dizgesini doğrular. Geçerliyse ödül bilgilerini, değilse null döner.
 * `maxAgeMs` eski (tekrar oynatılan) istekleri reddeder.
 */
export async function verifySsv(rawQuery: string, keys: VerifierKey[], now = Date.now(), maxAgeMs = 60 * 60_000): Promise<SsvPayload | null> {
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  const sigIndex = query.indexOf('&signature=');
  if (sigIndex < 0) return null;
  const message = query.slice(0, sigIndex);
  const params = new URLSearchParams(query);
  const signature = params.get('signature');
  const keyId = Number(params.get('key_id'));
  const transactionId = params.get('transaction_id');
  const timestamp = Number(params.get('timestamp'));
  if (!signature || !Number.isFinite(keyId) || !transactionId || !Number.isFinite(timestamp)) return null;
  if (Math.abs(now - timestamp) > maxAgeMs) return null;

  const key = keys.find((k) => k.keyId === keyId);
  if (!key) return null;
  try {
    const publicKey = await crypto.subtle.importKey('spki', b64ToBytes(key.base64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, derToP1363(b64UrlToBytes(signature)), new TextEncoder().encode(message));
    if (!ok) return null;
  } catch {
    return null;
  }
  return { userId: params.get('user_id'), customData: params.get('custom_data'), transactionId, keyId, timestamp };
}

/** Google'ın doğrulama anahtarlarını getirir. */
export async function fetchVerifierKeys(url = VERIFIER_KEYS_URL): Promise<VerifierKey[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`verifier keys ${res.status}`);
  const body = await res.json();
  return Array.isArray(body?.keys) ? body.keys.filter((k: VerifierKey) => typeof k.keyId === 'number' && typeof k.base64 === 'string') : [];
}
