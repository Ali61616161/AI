// Ülkelere göre acil durum numaraları (Ekim 2026 itibarıyla). Uygulamanın içinde
// gelir, internetsiz çalışır. "general" tek numaralı acil hattıdır; yoksa
// polis/ambulans/itfaiye ayrı aranır. 112 birçok ülkede cep telefonundan çalışır.

export type EmergencyNumbers = { general?: string; police?: string; ambulance?: string; fire?: string; tourist?: string };

const EU112: EmergencyNumbers = { general: '112' };

export const EMERGENCY_NUMBERS: Record<string, EmergencyNumbers> = {
  // Avrupa Birliği ve 112 kullanan Avrupa ülkeleri
  AT: EU112, BE: EU112, BG: EU112, HR: EU112, CY: EU112, CZ: EU112, DK: EU112, EE: EU112, FI: EU112,
  FR: { general: '112', police: '17', ambulance: '15', fire: '18' },
  DE: { general: '112', police: '110' },
  GR: { general: '112', police: '100', ambulance: '166', fire: '199', tourist: '1571' },
  HU: EU112, IE: { general: '112' },
  IT: { general: '112', police: '113', ambulance: '118', fire: '115' },
  LV: EU112, LT: EU112, LU: EU112, MT: EU112, NL: EU112, PL: EU112, PT: EU112, RO: EU112, SK: EU112, SI: EU112,
  ES: { general: '112', police: '091', ambulance: '061', fire: '080' },
  SE: EU112, MC: EU112, SM: EU112, VA: EU112, AD: EU112, LI: EU112, IS: EU112, ME: EU112, MK: EU112,
  AL: { general: '112', police: '129' },
  CH: { general: '112', police: '117', ambulance: '144', fire: '118' },
  NO: { police: '112', ambulance: '113', fire: '110' },
  GB: { general: '999' },
  RS: { police: '192', ambulance: '194', fire: '193' },
  BA: { police: '122', ambulance: '124', fire: '123' },
  TR: { general: '112' },
  RU: { general: '112', police: '102', ambulance: '103', fire: '101' },
  UA: { general: '112', police: '102', ambulance: '103', fire: '101' },
  GE: { general: '112' },
  AZ: { general: '112', police: '102', ambulance: '103', fire: '101' },
  // Amerika
  US: { general: '911' }, CA: { general: '911' }, MX: { general: '911' },
  BR: { police: '190', ambulance: '192', fire: '193' },
  AR: { general: '911', ambulance: '107', fire: '100' },
  CL: { police: '133', ambulance: '131', fire: '132' },
  CO: { general: '123' },
  PE: { police: '105', ambulance: '106', fire: '116' },
  CU: { police: '106', ambulance: '104', fire: '105' },
  DO: { general: '911' }, CR: { general: '911' }, PA: { general: '911' }, EC: { general: '911' }, UY: { general: '911' }, PY: { general: '911' },
  BO: { police: '110', ambulance: '118', fire: '119' },
  // Orta Doğu ve Afrika
  AE: { police: '999', ambulance: '998', fire: '997' },
  SA: { general: '911' },
  QA: { general: '999' },
  JO: { general: '911' },
  IL: { police: '100', ambulance: '101', fire: '102' },
  LB: { police: '112', ambulance: '140', fire: '175' },
  EG: { police: '122', ambulance: '123', fire: '180', tourist: '126' },
  MA: { police: '19', ambulance: '15', fire: '15' },
  TN: { police: '197', ambulance: '190', fire: '198' },
  ZA: { general: '112', police: '10111', ambulance: '10177' },
  KE: { general: '999' },
  // Asya ve Okyanusya
  JP: { police: '110', ambulance: '119', fire: '119' },
  KR: { police: '112', ambulance: '119', fire: '119' },
  CN: { police: '110', ambulance: '120', fire: '119' },
  HK: { general: '999' },
  TW: { police: '110', ambulance: '119', fire: '119' },
  SG: { police: '999', ambulance: '995', fire: '995' },
  MY: { general: '999' },
  TH: { police: '191', ambulance: '1669', fire: '199', tourist: '1155' },
  VN: { police: '113', ambulance: '115', fire: '114' },
  ID: { general: '112', police: '110', ambulance: '118' },
  PH: { general: '911' },
  IN: { general: '112' },
  AU: { general: '000' },
  NZ: { general: '111' },
};

export function emergencyNumbersFor(countryCode: string | null | undefined): EmergencyNumbers | null {
  return countryCode ? (EMERGENCY_NUMBERS[countryCode.toUpperCase()] ?? null) : null;
}

export { localCountryName as countryName } from './countries.ts';

/** Bayrak emojisi (ülke kodundan). */
export function flag(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}
