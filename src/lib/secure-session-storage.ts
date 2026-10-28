import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

import { joinChunks, safeKey, splitChunks } from './chunk-storage';

/**
 * Supabase oturumunun saklandığı yer: iOS Keychain / Android Keystore (SecureStore). Düz AsyncStorage'dan farklı olarak
 * yedeklerde okunabilir dosya olarak durmaz. Eski sürümlerden kalan AsyncStorage oturumu ilk okumada taşınır.
 * Her aşamada hata olursa AsyncStorage'a düşülür; böylece oturum açma ve internetsiz açılış asla bozulmaz.
 */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
const REGISTRY = 'yola.secureKeys';

const countKey = (key: string) => `${safeKey(key)}.n`;
const partKey = (key: string, i: number) => `${safeKey(key)}.${i}`;

async function remember(key: string) {
  try {
    const list: string[] = JSON.parse((await AsyncStorage.getItem(REGISTRY)) ?? '[]');
    if (!list.includes(key)) await AsyncStorage.setItem(REGISTRY, JSON.stringify([...list, key]));
  } catch {
    // kayıt tutulamazsa çıkışta bilinen anahtarlar yine de silinir (aşağıya bakın)
  }
}

async function readSecure(key: string): Promise<string | null> {
  const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS));
  if (!Number.isFinite(count) || count < 1) return null;
  const parts: (string | null)[] = [];
  for (let i = 0; i < count; i++) parts.push(await SecureStore.getItemAsync(partKey(key, i), OPTIONS));
  return joinChunks(count, (i) => parts[i]);
}

async function deleteSecure(key: string) {
  const count = Number(await SecureStore.getItemAsync(countKey(key), OPTIONS).catch(() => null));
  const total = Number.isFinite(count) && count > 0 ? count : 0;
  for (let i = 0; i < total; i++) await SecureStore.deleteItemAsync(partKey(key, i), OPTIONS).catch(() => undefined);
  await SecureStore.deleteItemAsync(countKey(key), OPTIONS).catch(() => undefined);
}

async function writeSecure(key: string, value: string) {
  const parts = splitChunks(value);
  for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(partKey(key, i), parts[i], OPTIONS);
  // Sayaç en son yazılır: yarım kalan yazma "kayıt yok" sayılır, bozuk oturum okunmaz.
  await SecureStore.setItemAsync(countKey(key), String(parts.length), OPTIONS);
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      const secure = await readSecure(key);
      if (secure !== null) return secure;
    } catch {
      // Keychain okunamadı: eski kayda bakılır
    }
    const legacy = await AsyncStorage.getItem(key);
    if (legacy !== null) {
      // Eski sürümden kalan oturum güvenli depoya taşınır.
      try {
        await writeSecure(key, legacy);
        await remember(key);
        await AsyncStorage.removeItem(key);
      } catch {
        // taşınamadı: eski yerinde kalır, bir sonraki açılışta tekrar denenir
      }
    }
    return legacy;
  },
  async setItem(key: string, value: string): Promise<void> {
    try {
      await writeSecure(key, value);
      await remember(key);
      await AsyncStorage.removeItem(key).catch(() => undefined);
    } catch {
      await AsyncStorage.setItem(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    await deleteSecure(key).catch(() => undefined);
    await AsyncStorage.removeItem(key).catch(() => undefined);
  },
};

/** Çıkış, hesap silme ya da hesap değişiminde güvenli depodaki tüm oturum kayıtlarını siler (internet gerekmez). */
export async function clearSecureSession(): Promise<void> {
  let keys: string[] = [];
  try {
    keys = JSON.parse((await AsyncStorage.getItem(REGISTRY)) ?? '[]');
  } catch {
    keys = [];
  }
  const known = new Set(keys);
  const ref = process.env.EXPO_PUBLIC_SUPABASE_URL?.match(/^https?:\/\/([^.]+)\./)?.[1];
  if (ref) {
    known.add(`sb-${ref}-auth-token`);
    known.add(`sb-${ref}-auth-token-code-verifier`);
  }
  for (const key of known) await deleteSecure(key).catch(() => undefined);
  await AsyncStorage.removeItem(REGISTRY).catch(() => undefined);
}
