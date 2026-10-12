// Çark için ülke havuzu: bölge, yaklaşık günlük maliyet seviyesi, en iyi aylar, tarz ve
// planlamaya başlanacak şehir. Değerler yaklaşıktır ve fikir vermek içindir; çatışma
// bölgeleri ve seyahat uyarısı yüksek ülkeler havuza alınmamıştır.
import { bestAccess, isEasy } from './visa-access.ts';

export type Region = 'europe' | 'middle_east' | 'asia' | 'africa' | 'americas' | 'oceania';
export type Vibe = 'beach' | 'city' | 'culture' | 'food' | 'nature' | 'adventure';
/** Kişi başı günlük yaklaşık harcama: 1 ≈ 50 $ altı, 2 ≈ 50–100 $, 3 ≈ 100–180 $, 4 ≈ 180 $ üstü. */
export type CostLevel = 1 | 2 | 3 | 4;

export type Destination = { code: string; region: Region; cost: CostLevel; months: number[]; vibes: Vibe[]; city: string };

// kod|bölge|maliyet|aylar|tarz|şehir
const RAW = `
AL|europe|1|5-9|beach,nature,culture|Tirana
AT|europe|3|5-9,12|city,nature,culture|Vienna
BA|europe|1|5-9|culture,nature|Sarajevo
BE|europe|3|4-9|city,food,culture|Brussels
BG|europe|1|5-9,1-2|beach,culture,nature|Sofia
HR|europe|2|5-9|beach,nature|Split
CY|europe|2|4-10|beach|Paphos
CZ|europe|2|4-9,12|city,culture|Prague
DK|europe|4|5-9|city,food|Copenhagen
EE|europe|2|5-9|city,culture|Tallinn
FI|europe|3|6-8,12-3|nature,adventure|Helsinki
FR|europe|3|4-10|city,food,culture|Paris
DE|europe|3|5-9,12|city,culture|Berlin
GR|europe|2|5-10|beach,culture,food|Athens
HU|europe|2|4-10,12|city,culture,food|Budapest
IS|europe|4|6-8,2-3|nature,adventure|Reykjavik
IE|europe|3|5-9|nature,city|Dublin
IT|europe|3|4-10|food,culture,beach|Rome
LV|europe|2|5-9|city|Riga
LT|europe|2|5-9|city|Vilnius
LU|europe|4|5-9|city|Luxembourg
MT|europe|2|4-10|beach,culture|Valletta
ME|europe|2|5-9|beach,nature|Kotor
NL|europe|3|4-9|city,culture|Amsterdam
MK|europe|1|5-9|nature,culture|Ohrid
NO|europe|4|6-8,1-3|nature,adventure|Bergen
PL|europe|2|5-9,12|city,culture,food|Krakow
PT|europe|2|4-10|beach,city,food|Lisbon
RO|europe|1|5-9|nature,culture|Brasov
RS|europe|1|4-10|city,food|Belgrade
SK|europe|2|5-9,1-2|nature,city|Bratislava
SI|europe|2|5-9|nature|Ljubljana
ES|europe|2|4-10|beach,food,city|Barcelona
SE|europe|3|6-8|city,nature|Stockholm
CH|europe|4|6-9,12-3|nature,adventure|Lucerne
GB|europe|3|5-9|city,culture|London
GE|europe|1|5-10|food,nature,culture|Tbilisi
AM|europe|1|5-10|culture,nature|Yerevan
AZ|europe|1|4-6,9-10|city,culture|Baku
MD|europe|1|5-9|food,culture|Chisinau
TR|europe|1|4-10|beach,culture,food|Istanbul
AE|middle_east|3|11-3|city,beach|Dubai
OM|middle_east|2|10-3|nature,adventure|Muscat
QA|middle_east|3|11-3|city|Doha
JO|middle_east|2|3-5,9-11|culture,adventure|Amman
SA|middle_east|3|11-3|culture,city|Riyadh
BH|middle_east|2|11-3|city|Manama
JP|asia|3|3-5,10-11|city,food,culture|Tokyo
KR|asia|2|4-6,9-11|city,food|Seoul
CN|asia|2|4-5,9-10|culture,city|Shanghai
HK|asia|3|10-12|city,food|Hong Kong
TW|asia|2|10-4|food,city|Taipei
TH|asia|1|11-3|beach,food,culture|Bangkok
VN|asia|1|2-5|food,beach,nature|Hanoi
KH|asia|1|11-3|culture|Siem Reap
LA|asia|1|11-3|nature,culture|Luang Prabang
MY|asia|1|1-9|city,food,beach|Kuala Lumpur
SG|asia|3|2-4,7-9|city,food|Singapore
ID|asia|1|4-10|beach,nature|Bali
PH|asia|1|12-5|beach,nature|Manila
IN|asia|1|10-3|culture,food|Jaipur
NP|asia|1|10-11,3-5|adventure,nature|Kathmandu
LK|asia|1|12-4|beach,nature,culture|Colombo
MV|asia|4|11-4|beach|Malé
UZ|asia|1|4-6,9-10|culture|Samarkand
KZ|asia|2|5-9|nature,city|Almaty
KG|asia|1|6-9|nature,adventure|Bishkek
MN|asia|2|6-8|nature,adventure|Ulaanbaatar
EG|africa|1|10-4|culture,beach|Cairo
MA|africa|1|3-5,9-11|culture,food|Marrakech
TN|africa|1|4-6,9-10|beach,culture|Tunis
ZA|africa|2|9-4|nature,city,food|Cape Town
KE|africa|3|7-10,1-2|nature,adventure|Nairobi
TZ|africa|3|6-10,1-2|nature,beach|Zanzibar
MU|africa|3|5-12|beach|Port Louis
SC|africa|4|4-5,10-11|beach|Victoria
NA|africa|3|5-10|nature,adventure|Windhoek
RW|africa|2|6-9,12-2|nature|Kigali
CV|africa|2|11-6|beach|Sal
SN|africa|2|11-5|culture,beach|Dakar
GH|africa|2|11-3|culture|Accra
BW|africa|4|5-10|nature,adventure|Maun
US|americas|4|4-6,9-10|city,nature|New York
CA|americas|3|6-9,12-3|nature,city|Vancouver
MX|americas|2|11-4|beach,food,culture|Mexico City
CU|americas|1|11-4|culture,beach|Havana
DO|americas|2|12-4|beach|Punta Cana
JM|americas|3|12-4|beach|Montego Bay
CR|americas|3|12-4|nature,adventure|San José
PA|americas|2|12-4|city,beach|Panama City
CO|americas|1|12-3,7-8|city,culture,nature|Medellín
PE|americas|2|5-9|culture,adventure|Cusco
EC|americas|2|6-9|nature,adventure|Quito
BO|americas|1|5-10|nature,adventure|La Paz
CL|americas|3|10-3|nature,adventure|Santiago
AR|americas|2|10-4|city,food,nature|Buenos Aires
BR|americas|2|4-6,9-11|beach,city|Rio de Janeiro
UY|americas|2|11-3|beach,city|Montevideo
GT|americas|1|11-4|culture,nature|Antigua Guatemala
BS|americas|4|12-4|beach|Nassau
BB|americas|4|12-4|beach|Bridgetown
AU|oceania|4|9-11,3-5|nature,city,beach|Sydney
NZ|oceania|4|11-4|nature,adventure|Queenstown
FJ|oceania|3|5-10|beach|Nadi
`;

function months(spec: string): number[] {
  const out = new Set<number>();
  for (const part of spec.split(',')) {
    const [a, b] = part.split('-').map(Number);
    if (!b) {
      out.add(a);
      continue;
    }
    // Yıl sonunu aşan aralık (ör. 11-3 → Kasım..Mart).
    for (let m = a; ; m = (m % 12) + 1) {
      out.add(m);
      if (m === b) break;
    }
  }
  return [...out].sort((x, y) => x - y);
}

export const DESTINATIONS: Destination[] = RAW.trim()
  .split('\n')
  .map((line) => {
    const [code, region, cost, m, vibes, city] = line.split('|');
    return { code, region: region as Region, cost: Number(cost) as CostLevel, months: months(m), vibes: vibes.split(',') as Vibe[], city };
  });

export type VisaFilter = 'easy' | 'evisa' | 'any';
export type SpinFilters = {
  passports: string[];
  extras: string[];
  /** 1-12; null = mevsim önemli değil. */
  month: number | null;
  maxCost: CostLevel;
  visa: VisaFilter;
  region: Region | null;
  vibe: Vibe | null;
};

/** Filtrelere uyan ülkeler (kullanıcının kendi ülkeleri hariç). */
export function spinPool(f: SpinFilters): Destination[] {
  return DESTINATIONS.filter((d) => {
    if (f.passports.includes(d.code) || d.cost > f.maxCost) return false;
    if (f.month !== null && !d.months.includes(f.month)) return false;
    if (f.region && d.region !== f.region) return false;
    if (f.vibe && !d.vibes.includes(f.vibe)) return false;
    if (f.visa !== 'any' && f.passports.length) {
      const a = bestAccess(f.passports, f.extras, d.code);
      if (!a || a.status === 'no_admission') return false;
      if (f.visa === 'easy' && !isEasy(a.status)) return false;
      if (f.visa === 'evisa' && !isEasy(a.status) && a.status !== 'evisa') return false;
    }
    return true;
  });
}

/** Çarkta gösterilecek en fazla `size` aday ve aralarından kazanan (rastgele). */
export function drawWheel(pool: Destination[], size = 8, random: () => number = Math.random): { slots: Destination[]; winner: number } | null {
  if (!pool.length) return null;
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const slots = shuffled.slice(0, Math.min(size, shuffled.length));
  return { slots, winner: Math.floor(random() * slots.length) % slots.length };
}

/** Kazanan dilimin oka (üstte) gelmesi için gereken son açı: en az `turns` tam tur. */
export function landingAngle(current: number, winner: number, count: number, turns = 6): number {
  const step = 360 / count;
  const target = 360 - (winner * step + step / 2);
  const base = Math.ceil(current / 360) * 360;
  return base + turns * 360 + target;
}
