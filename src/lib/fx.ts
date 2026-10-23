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
 * Güncel döviz kuru (open.er-api.com, yedek: AMB/frankfurter; anahtar gerekmez).
 * 1 saat önbelleklenir; ağ yoksa eski kur kullanılır. Hiç kur yoksa null.
 */
export async function getRate(from: string, to: string): Promise<number | null> {
  if (from.toUpperCase() === to.toUpperCase()) return 1;
  const cache = await load();
  const key = rateKey(from, to);
  if (isFresh(cache[key], Date.now())) return cache[key].rate;
  // Önce geniş kapsamlı kaynak (~160 para birimi), olmazsa AMB (frankfurter).
  const sources = [
    `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`,
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`,
  ];
  for (const url of sources) {
    try {
      // Yavaş/kapalı ağda (otel Wi-Fi giriş sayfası gibi) takılmamak için kaynak başına 6 sn.
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
      const rate = res.ok ? parseRate(await res.json(), to) : null;
      if (rate !== null) {
        cache[key] = { rate, at: Date.now() };
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(cache)).catch(() => {});
        return rate;
      }
    } catch {
      // bu kaynak yanıt vermedi: sıradakine geç
    }
  }
  return cache[key]?.rate ?? null;
}

/** Tutarı hedef para birimine çevirir; kur bulunamazsa null. */
export async function convertAmount(amount: number, from: string, to: string): Promise<number | null> {
  const rate = await getRate(from, to);
  return rate === null ? null : convert(amount, rate);
}
