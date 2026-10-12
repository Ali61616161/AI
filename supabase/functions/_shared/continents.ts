// Ülkelerin kıtaları (gezdiğim ülkeler yüzdeleri için). Kafkasya Asya'da, Türkiye Avrupa'da sayılır.
export type Continent = 'europe' | 'asia' | 'africa' | 'north_america' | 'south_america' | 'oceania';

const RAW: Record<Continent, string> = {
  europe: 'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM TR UA VA XK',
  asia: 'AE AF AM AZ BD BH BN BT CN GE HK ID IL IN IQ IR JO JP KG KH KP KR KW KZ LA LB LK MM MN MO MV MY NP OM PH PK PS QA SA SG SY TH TJ TL TM TW UZ VN YE',
  africa: 'AO BF BI BJ BW CD CF CG CI CM CV DJ DZ EG ER ET GA GH GM GN GQ GW KE KM LR LS LY MA MG ML MR MU MW MZ NA NE NG RW SC SD SL SN SO SS ST SZ TD TG TN TZ UG ZA ZM ZW',
  north_america: 'AG BB BS BZ CA CR CU DM DO GD GT HN HT JM KN LC MX NI PA SV TT US VC',
  south_america: 'AR BO BR CL CO EC GY PE PY SR UY VE',
  oceania: 'AU FJ FM KI MH NR NZ PG PW SB TO TV VU WS',
};

export const CONTINENTS = Object.keys(RAW) as Continent[];
export const COUNTRIES_BY_CONTINENT: Record<Continent, string[]> = Object.fromEntries(
  CONTINENTS.map((c) => [c, RAW[c].split(' ')]),
) as Record<Continent, string[]>;
export const CONTINENT_OF: Record<string, Continent> = Object.fromEntries(CONTINENTS.flatMap((c) => COUNTRIES_BY_CONTINENT[c].map((code) => [code, c])));
export const WORLD_COUNT = Object.keys(CONTINENT_OF).length;

export type VisitedSummary = {
  countries: number;
  percent: number;
  continents: number;
  byContinent: { continent: Continent; visited: number; total: number; percent: number }[];
};

/** Gezilen ülkelerden dünya ve kıta yüzdeleri (bir ondalık). */
export function summarizeVisited(codes: Iterable<string>): VisitedSummary {
  const set = new Set([...codes].filter((c) => c in CONTINENT_OF));
  const pct = (n: number, d: number) => Math.round((1000 * n) / d) / 10;
  const byContinent = CONTINENTS.map((continent) => {
    const total = COUNTRIES_BY_CONTINENT[continent].length;
    const visited = COUNTRIES_BY_CONTINENT[continent].filter((c) => set.has(c)).length;
    return { continent, visited, total, percent: pct(visited, total) };
  });
  return { countries: set.size, percent: pct(set.size, WORLD_COUNT), continents: byContinent.filter((b) => b.visited > 0).length, byContinent };
}
