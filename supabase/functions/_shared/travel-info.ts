// Vize ve giriş koşulları: pasaport ülkesi ve varış ülkesine göre Gemini'den
// genel bilgi. Kurallar sık değiştiği için cevap her zaman "resmi kaynaktan
// doğrulayın" uyarısıyla ve kaynak bağlantılarıyla gösterilir.

export const VISA_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    requirement: { type: 'STRING', enum: ['visa_free', 'visa_on_arrival', 'evisa', 'visa_required', 'freedom_of_movement', 'unknown'] },
    max_stay_days: { type: 'INTEGER', description: 'Maximum stay without a visa or with the typical visa, 0 if unknown' },
    summary: { type: 'STRING' },
    documents: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Documents usually asked at the border' },
    notes: { type: 'ARRAY', items: { type: 'STRING' }, description: 'Passport validity, return ticket, ETIAS/ETA/ESTA style pre-registration, vaccinations' },
    official_url: { type: 'STRING', description: 'Official government page, only if you are sure it exists; otherwise empty' },
  },
  required: ['requirement', 'summary'],
};

export type VisaInfo = {
  requirement: 'visa_free' | 'visa_on_arrival' | 'evisa' | 'visa_required' | 'freedom_of_movement' | 'unknown';
  maxStayDays: number | null;
  summary: string;
  documents: string[];
  notes: string[];
  officialUrl: string | null;
};

const COUNTRY = /^[A-Z]{2}$/;
export const isCountryCode = (v: unknown): v is string => typeof v === 'string' && COUNTRY.test(v);

export function buildVisaPrompt(input: { passport: string; destination: string; languageName: string; purpose: 'tourism'; today: string }): string {
  const name = (code: string) => new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  return `A traveler holding a passport of ${name(input.passport)} (${input.passport}) plans a short ${input.purpose} trip to ${name(input.destination)} (${input.destination}). Today is ${input.today}.

Give the entry requirements as generally known: whether a visa is needed (visa_free, visa_on_arrival, evisa, visa_required, or freedom_of_movement for EU/EEA/Schengen-type agreements), the usual maximum stay, documents usually asked at the border, and important notes (passport validity, pre-travel authorisations such as ETIAS, UK ETA or US ESTA, vaccinations).
Only state what you are confident about; if unsure use "unknown" and say that the traveler must check. Never invent an official URL.
Write summary, documents and notes in ${input.languageName}, short and clear.`;
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function normalizeVisa(raw: unknown): VisaInfo {
  // deno-lint-ignore no-explicit-any
  const r = (raw && typeof raw === 'object' ? raw : {}) as any;
  const requirements = ['visa_free', 'visa_on_arrival', 'evisa', 'visa_required', 'freedom_of_movement', 'unknown'];
  const list = (v: unknown) =>
    (Array.isArray(v) ? v : [])
      .map((x) => str(x, 200))
      .filter((x): x is string => x !== null)
      .slice(0, 8);
  const url = str(r.official_url, 300);
  return {
    requirement: requirements.includes(r.requirement) ? r.requirement : 'unknown',
    maxStayDays: Number.isInteger(r.max_stay_days) && r.max_stay_days > 0 && r.max_stay_days <= 3650 ? r.max_stay_days : null,
    summary: str(r.summary, 600) ?? '',
    documents: list(r.documents),
    notes: list(r.notes),
    officialUrl: url && /^https:\/\/[^\s]+$/.test(url) ? url : null,
  };
}
