import { currentLanguage } from '@/i18n';

import { currencyFlag } from './fx-logic';

/** Para biriminin sembolü ("₺", "€", "$"); bulunamazsa kodun kendisi. */
export function currencySymbol(code: string): string {
  try {
    const part = new Intl.NumberFormat(currentLanguage(), { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0).find((p) => p.type === 'currency');
    return part?.value ?? code;
  } catch {
    return code;
  }
}

/** Listede görünen etiket: "🇹🇷 ₺ · TRY · Türk Lirası". `short`: kapalı düğmede "₺ TRY". */
export function currencyOption(code: string): { value: string; label: string; short: string } {
  const symbol = currencySymbol(code);
  let name: string | undefined;
  try {
    name = new Intl.DisplayNames(currentLanguage(), { type: 'currency' }).of(code);
  } catch {
    name = undefined;
  }
  const flag = currencyFlag(code);
  const label = [flag, symbol !== code ? symbol : null, code, name && name !== code ? `· ${name}` : null].filter(Boolean).join(' ');
  return { value: code, label, short: symbol !== code ? `${symbol} ${code}` : code };
}
