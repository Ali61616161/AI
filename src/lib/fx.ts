import AsyncStorage from '@react-native-async-storage/async-storage';

import { convert, isFresh, parseRate, rateKey, type CachedRate } from '@/lib/fx-logic';

const STORAGE_KEY = 'yola.fx.v1';
let memory: Record<string, CachedRate> | null = null;

async function load(): Promise<Record<string, CachedRate>> {
  if (memory) return memory;
  try {
    memory = JSON.parse((await AsyncStorage.getItem(STORAGE_KEY)) ?? '{}');
  } catch {
    memory = {};
  }
  return memory!;
}

/**
 * Güncel döviz kuru (Avrupa Merkez Bankası verisi, frankfurter.dev; anahtar gerekmez).
 * 6 saat önbelleklenir; ağ yoksa eski kur kullanılır. Hiç kur yoksa null.
 */
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  const cache = await load();
  const key = rateKey(from, to);
  if (isFresh(cache[key], Date.now())) return cache[key].rate;
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`);
    const rate = res.ok ? parseRate(await res.json(), to) : null;
    if (rate !== null) {
      cache[key] = { rate, at: Date.now() };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => {});
      return rate;
    }
  } catch {
    // ağ yok: eski kura düş
  }
  return cache[key]?.rate ?? null;
}

/** Tutarı hedef para birimine çevirir; kur bulunamazsa null. */
export async function convertAmount(amount: number, from: string, to: string): Promise<number | null> {
  const rate = await getRate(from, to);
  return rate === null ? null : convert(amount, rate);
}
