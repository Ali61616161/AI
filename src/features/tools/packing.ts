// Seyahate göre bavul listesi önerisi: süre, hava, yol arkadaşı, ilgi alanları ve
// planlanan açık hava etkinlikleri. Kural tabanlıdır, internetsiz çalışır; kullanıcı
// listeyi düzenleyebilir.

export type PackingCategory = 'documents' | 'clothes' | 'toiletries' | 'electronics' | 'health' | 'kids' | 'extras';
export type PackingSuggestion = { key: string; category: PackingCategory; quantity: number };

export type PackingInput = {
  nights: number;
  minTemp: number | null;
  maxTemp: number | null;
  rainChance: number | null;
  companion: 'solo' | 'couple' | 'family' | 'friends' | null;
  children: number;
  interests: string[];
  hasOutdoor: boolean;
  hasFlight: boolean;
  international: boolean;
  plugType?: string | null;
};

/** Gün sayısına göre kıyafet adedi: 1 haftayı aşarsa çamaşır yıkanacağı varsayılır. */
const clothes = (nights: number, perDay = 1) => Math.max(1, Math.min(Math.ceil((nights + 1) * perDay), 8));

export function suggestPacking(input: PackingInput): PackingSuggestion[] {
  const list: PackingSuggestion[] = [];
  const add = (key: string, category: PackingCategory, quantity = 1) => list.push({ key, category, quantity });
  const cold = input.minTemp !== null && input.minTemp < 10;
  const veryCold = input.minTemp !== null && input.minTemp < 2;
  const hot = input.maxTemp !== null && input.maxTemp >= 26;
  const rainy = input.rainChance !== null && input.rainChance >= 40;

  add('passport', 'documents');
  if (input.international) add('travelInsurance', 'documents');
  add('bookings', 'documents');
  add('cards', 'documents');

  add('underwear', 'clothes', clothes(input.nights));
  add('socks', 'clothes', clothes(input.nights));
  add('tshirts', 'clothes', clothes(input.nights, 0.8));
  add('trousers', 'clothes', Math.min(Math.max(1, Math.ceil(input.nights / 3)), 4));
  add('sleepwear', 'clothes');
  add('walkingShoes', 'clothes');
  if (cold) add('warmJacket', 'clothes');
  if (veryCold) {
    add('hatGloves', 'clothes');
    add('thermals', 'clothes', 2);
  }
  if (!cold) add('lightJacket', 'clothes');
  if (hot) {
    add('shorts', 'clothes', 2);
    add('sunglasses', 'extras');
    add('sunscreen', 'toiletries');
    add('hat', 'clothes');
  }
  if (rainy) add('umbrella', 'extras');
  if (input.interests.includes('beach')) {
    add('swimwear', 'clothes');
    add('beachTowel', 'extras');
  }
  if (input.interests.includes('nightlife')) add('eveningOutfit', 'clothes');

  add('toothbrush', 'toiletries');
  add('toiletriesBag', 'toiletries');
  add('medications', 'health');
  add('firstAid', 'health');

  add('phoneCharger', 'electronics');
  add('powerBank', 'electronics');
  if (input.international) add('plugAdapter', 'electronics');
  if (input.hasFlight) {
    add('headphones', 'electronics');
    add('reusableBottle', 'extras');
  }

  if (input.hasOutdoor || input.interests.includes('nature')) {
    add('daypack', 'extras');
    if (input.interests.includes('nature')) add('hikingShoes', 'clothes');
  }

  if (input.children > 0 || input.companion === 'family') {
    add('kidsSnacks', 'kids');
    add('kidsEntertainment', 'kids');
    add('kidsMedicine', 'kids');
  }
  return list;
}

/** Etiket karşılaştırması: büyük/küçük harf ve baştaki/sondaki boşluk fark etmez. */
export const normalizePackingLabel = (label: string): string => label.trim().toLocaleLowerCase();

/**
 * Önerilerle eklenen eşyalar listeye o anki dildeki adıyla kaydediliyordu; dil değişince eski dilde kalıyordu.
 * Her dilin eşya adlarından "ad → anahtar" dizini kurulur; böylece kayıtlı ad hangi dilde olursa olsun anahtara,
 * oradan da güncel dildeki adına çevrilir.
 */
export function buildPackingLabelIndex(bundles: Iterable<Record<string, string>>): Map<string, string> {
  const index = new Map<string, string>();
  for (const bundle of bundles) {
    for (const [key, label] of Object.entries(bundle)) {
      if (typeof label !== 'string') continue;
      const norm = normalizePackingLabel(label);
      if (norm && !index.has(norm)) index.set(norm, key);
    }
  }
  return index;
}
