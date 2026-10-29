import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { DestinationField, type Destination } from '@/features/trips/destination-field';
import { saveIdentityToProfile } from '@/features/profile/save-preferences';
import { goBack } from '@/lib/go-back';
import { useSessionStore } from '@/stores/session-store';

/** "Yaşadığım şehir": Şehrim ve fırsatlar bu şehre göre çalışır. Yazdıkça şehir önerilir, seçince ülke de gelir. */
export default function HomeCityScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const identity = useSessionStore((s) => s.identity);
  const setIdentity = useSessionStore((s) => s.setIdentity);
  const session = useSessionStore((s) => s.session);
  const [dest, setDest] = useState<Destination>({ city: '', country: null });
  const [saving, setSaving] = useState(false);
  const valid = dest.city !== '' && dest.country !== null;

  async function save() {
    if (!valid) return;
    setSaving(true);
    const patch = { homeCity: dest.city, homeCountry: dest.country, homeLat: dest.lat ?? null, homeLng: dest.lng ?? null };
    setIdentity(patch);
    if (session) await saveIdentityToProfile(session.user.id, { ...identity, ...patch }).catch((e) => console.warn('Profil kaydedilemedi', e));
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    setSaving(false);
    goBack();
  }

  return (
    <Screen footer={<Button title={t('common.save')} disabled={!valid} loading={saving} onPress={save} />}>
      <ModalHeader title={t('homeCity.title')} subtitle={identity.homeCity ? t('homeCity.current', { city: identity.homeCity }) : t('identity.homeCityHint')} />
      <DestinationField value={dest} onChange={setDest} />
    </Screen>
  );
}
