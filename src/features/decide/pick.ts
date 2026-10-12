// "Kararsızım": kullanıcının seçtiği türde, yakında ve şu an açık bir yeri rastgele seçer.
// Saf fonksiyonlar; ekran ve testler kullanır.

import type { NearbyCategory, Place } from '../../../supabase/functions/_shared/places.ts';

export type DecideGroup = 'food' | 'coffee' | 'sweet' | 'drinks' | 'see' | 'surprise';

export const DECIDE_GROUPS: Record<Exclude<DecideGroup, 'surprise'>, NearbyCategory[]> = {
  food: ['restaurant'],
  coffee: ['cafe'],
  sweet: ['dessert', 'bakery'],
  drinks: ['bar'],
  see: ['attraction', 'museum', 'park'],
};

/** Gruptan bir Places kategorisi seçer; "sürpriz" bütün grupları kapsar. */
export function categoryFor(group: DecideGroup, random: () => number = Math.random): NearbyCategory {
  const pool = group === 'surprise' ? Object.values(DECIDE_GROUPS).flat() : DECIDE_GROUPS[group];
  return pool[Math.floor(random() * pool.length) % pool.length];
}

export type PickOptions = { exclude?: ReadonlySet<string>; minRating?: number | null; maxPrice?: number | null };

/** Uygun yerler: kapalı olmayan, koordinatı olan, istenirse puanı yeterli ve daha önce gösterilmemiş. */
export function candidates(places: readonly Place[], { exclude, minRating, maxPrice }: PickOptions = {}): Place[] {
  return places.filter(
    (p) =>
      p.openNow !== false &&
      p.status !== 'CLOSED_PERMANENTLY' &&
      p.status !== 'CLOSED_TEMPORARILY' &&
      !exclude?.has(p.id) &&
      (minRating == null || (p.rating !== null && p.rating >= minRating)) &&
      // Fiyat seviyesi bilinmeyen yerler fiyat filtresinden geçer.
      (maxPrice == null || p.priceLevel === null || p.priceLevel <= maxPrice),
  );
}

/**
 * Rastgele seçim; yüksek puanlı ve yakın yerlere biraz daha fazla şans verir ama
 * her uygun yerin seçilme ihtimali vardır.
 */
export function pickPlace(places: readonly Place[], options: PickOptions = {}, random: () => number = Math.random): Place | null {
  const pool = candidates(places, options);
  if (pool.length === 0) return null;
  const weights = pool.map((p) => {
    const rating = p.rating ?? 3.8;
    const near = p.distanceM === null ? 1 : Math.max(0.4, 1.4 - p.distanceM / 2500);
    return Math.max(0.1, (rating - 2.5) * near);
  });
  const total = weights.reduce((a, b) => a + b, 0);
  let r = random() * total;
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i];
    if (r <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}
