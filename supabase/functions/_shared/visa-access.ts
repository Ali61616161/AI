// Pasaport gücü ve ülkeye giriş durumu. Veri: Passport Index Data (passport-index.ts).
// Ek vizeler (Schengen, ABD, İngiltere...) visa-unlocks.ts'deki kaynaklı kurallarla
// bazı ülkelere girişi kolaylaştırır. Bilgi amaçlıdır; seyahatten önce resmi kaynaktan
// doğrulanmalıdır (uygulamada her zaman bu uyarıyla gösterilir).
import { DESTINATIONS, PASSPORT_ROWS } from './passport-index.ts';
import { VISA_UNLOCK_RULES, type UnlockRule } from './visa-unlocks.ts';

export const EXTRA_VISA_KEYS = [
  'schengen_visa',
  'us_visa',
  'uk_visa',
  'ca_visa',
  'au_visa',
  'nz_visa',
  'jp_visa',
  'ie_visa',
  'kr_visa',
  'eu_residence',
  'us_green_card',
  'uk_residence',
  'ca_pr',
  'au_pr',
  'gcc_residence',
  'jp_residence',
] as const;
export type ExtraVisa = (typeof EXTRA_VISA_KEYS)[number];

export function isExtraVisa(value: unknown): value is ExtraVisa {
  return typeof value === 'string' && (EXTRA_VISA_KEYS as readonly string[]).includes(value);
}

export type AccessStatus = 'own' | 'visa_free' | 'visa_on_arrival' | 'eta' | 'evisa' | 'visa_required' | 'no_admission';

/** Küçük sayı = daha kolay giriş. */
const EASE: Record<AccessStatus, number> = { own: 0, visa_free: 1, visa_on_arrival: 2, eta: 3, evisa: 4, visa_required: 5, no_admission: 6 };
const LETTER: Record<string, AccessStatus> = { S: 'own', F: 'visa_free', A: 'visa_on_arrival', T: 'eta', E: 'evisa', R: 'visa_required', X: 'no_admission' };

export const SCHENGEN = ['AT', 'BE', 'BG', 'CH', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'HU', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'];

/** Vizenin/oturumun kendisi o ülkeye (veya bölgeye) giriş hakkı verir. */
const HOME_OF: Partial<Record<ExtraVisa, string[]>> = {
  schengen_visa: SCHENGEN,
  eu_residence: SCHENGEN,
  us_visa: ['US'],
  us_green_card: ['US'],
  uk_visa: ['GB'],
  uk_residence: ['GB'],
  ca_visa: ['CA'],
  ca_pr: ['CA'],
  au_visa: ['AU'],
  au_pr: ['AU'],
  nz_visa: ['NZ'],
  jp_visa: ['JP'],
  jp_residence: ['JP'],
  ie_visa: ['IE'],
  kr_visa: ['KR'],
};

const destinations = DESTINATIONS.split(',');
const destIndex = new Map(destinations.map((c, i) => [c, i]));
const parsed = new Map<string, { status: AccessStatus; days: number | null }[]>();

function row(passport: string) {
  let r = parsed.get(passport);
  if (!r) {
    const raw = PASSPORT_ROWS[passport];
    if (!raw) return null;
    r = raw.split(',').map((cell) => ({ status: LETTER[cell[0]] ?? 'visa_required', days: cell.length > 1 ? Number(cell.slice(1)) : null }));
    parsed.set(passport, r);
  }
  return r;
}

export function hasPassportData(passport: string | null | undefined): passport is string {
  return !!passport && passport in PASSPORT_ROWS;
}

export const ALL_DESTINATIONS: readonly string[] = destinations;

export type Access = {
  status: AccessStatus;
  days: number | null;
  /** Bu durumu sağlayan pasaport veya ek vize. */
  via: { kind: 'passport'; code: string } | { kind: 'visa'; key: ExtraVisa; condition: string | null; source: string | null };
};

/** Tek bir pasaportla varış ülkesine giriş durumu (veri yoksa null). */
export function accessFor(passport: string, destination: string): { status: AccessStatus; days: number | null } | null {
  const r = row(passport);
  const i = destIndex.get(destination);
  if (!r || i === undefined) return null;
  return r[i];
}

function unlockFor(rule: UnlockRule, passports: string[]): boolean {
  return !rule.nationalities || rule.nationalities.some((n) => passports.includes(n));
}

/**
 * Kullanıcının tüm pasaportları ve ek vizeleriyle bir ülkeye en kolay giriş yolu.
 * Ek vize kuralı sadece pasaportla erişim daha zorsa kullanılır.
 */
export function bestAccess(passports: string[], extras: string[], destination: string, rules: UnlockRule[] = VISA_UNLOCK_RULES, today = new Date().toISOString().slice(0, 10)): Access | null {
  let best: Access | null = null;
  for (const p of passports) {
    const a = accessFor(p, destination);
    if (a && (!best || EASE[a.status] < EASE[best.status] || (a.status === best.status && (a.days ?? 0) > (best.days ?? 0)))) {
      best = { ...a, via: { kind: 'passport', code: p } };
    }
  }
  if (!best) return null;
  if (best.status === 'no_admission' || EASE[best.status] <= EASE.visa_free) return best;

  for (const key of extras.filter(isExtraVisa)) {
    if (HOME_OF[key]?.includes(destination)) {
      return { status: 'visa_free', days: null, via: { kind: 'visa', key, condition: null, source: null } };
    }
  }
  for (const rule of rules) {
    if (rule.destination !== destination || !extras.includes(rule.holder) || !unlockFor(rule, passports)) continue;
    if (rule.valid_until && today > rule.valid_until) continue;
    if (EASE[rule.effect] < EASE[best.status]) {
      best = { status: rule.effect, days: rule.max_days, via: { kind: 'visa', key: rule.holder, condition: rule.condition, source: rule.source } };
    }
  }
  return best;
}

/** Vize gerektirmeyen (vizesiz, varışta vize, elektronik izin) sayılır; pasaport gücü bu sayıdır. */
export function isEasy(status: AccessStatus): boolean {
  return status === 'visa_free' || status === 'visa_on_arrival' || status === 'eta';
}

export type PassportPower = {
  visaFree: number;
  onArrival: number;
  eta: number;
  evisa: number;
  required: number;
  /** Vizesiz + varışta vize + elektronik izin (Passport Index "mobility score" ile aynı mantık). */
  score: number;
  /** Ek vizelerle kolaylaşan ülke sayısı. */
  unlocked: number;
  /** Dünya sıralaması (aynı puanlılar aynı sırada), sadece pasaporta göre. */
  rank: number | null;
};

let ranking: Map<string, number> | null = null;
function worldRank(passport: string): number | null {
  if (!ranking) {
    const scores = Object.keys(PASSPORT_ROWS).map((p) => [p, (row(p) ?? []).filter((a) => isEasy(a.status)).length] as const);
    const sorted = [...new Set(scores.map(([, s]) => s))].sort((a, b) => b - a);
    ranking = new Map(scores.map(([p, s]) => [p, sorted.indexOf(s) + 1]));
  }
  return ranking.get(passport) ?? null;
}

export function passportPower(passports: string[], extras: string[] = []): PassportPower | null {
  const valid = passports.filter(hasPassportData);
  if (!valid.length) return null;
  const out: PassportPower = { visaFree: 0, onArrival: 0, eta: 0, evisa: 0, required: 0, score: 0, unlocked: 0, rank: null };
  for (const d of destinations) {
    if (valid.includes(d)) continue;
    const a = bestAccess(valid, extras, d);
    const base = bestAccess(valid, [], d);
    if (!a || !base || a.status === 'own') continue;
    if (a.status === 'visa_free') out.visaFree++;
    else if (a.status === 'visa_on_arrival') out.onArrival++;
    else if (a.status === 'eta') out.eta++;
    else if (a.status === 'evisa') out.evisa++;
    else out.required++;
    if (isEasy(a.status)) out.score++;
    if (EASE[a.status] < EASE[base.status]) out.unlocked++;
  }
  const ranks = valid.map(worldRank).filter((r): r is number => r !== null);
  out.rank = ranks.length ? Math.min(...ranks) : null;
  return out;
}
