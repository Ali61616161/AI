import { useMemo } from 'react';

import { passportPower } from '../../../supabase/functions/_shared/visa-access.ts';
import type { TravelIdentity } from '@/stores/session-store';

/** Kullanıcının tüm pasaportları ve ek vizeleriyle pasaport gücü (telefonda hesaplanır, internet gerekmez). */
export function usePassportPower(identity: Pick<TravelIdentity, 'passport' | 'otherPassports' | 'extraVisas'>) {
  const { passport, otherPassports, extraVisas } = identity;
  return useMemo(() => {
    const passports = [passport, ...otherPassports].filter((p): p is string => !!p);
    return passportPower(passports, extraVisas);
  }, [passport, otherPassports, extraVisas]);
}
