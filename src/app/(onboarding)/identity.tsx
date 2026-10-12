import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { Text } from '@/components/ui/text';
import { IdentityForm } from '@/features/identity/identity-form';
import { saveIdentityToProfile } from '@/features/profile/save-preferences';
import { COUNTRIES } from '@/features/tools/countries';
import { useSessionStore } from '@/stores/session-store';

/** Kayıt adımı 1: vatandaşlık, ek vizeler ve yaşanan şehir. */
export default function IdentityStep() {
  const { t } = useTranslation();
  const identity = useSessionStore((s) => s.identity);
  const setIdentity = useSessionStore((s) => s.setIdentity);
  const [saving, setSaving] = useState(false);

  // Vatandaşlık seçilmemişse cihaz bölgesi öneri olarak gelir (kullanıcı değiştirebilir).
  useEffect(() => {
    if (identity.passport) return;
    const region = getLocales()[0]?.regionCode?.toUpperCase();
    if (region && COUNTRIES.some((c) => c.code === region)) setIdentity({ passport: region, homeCountry: identity.homeCountry ?? region });
  }, [identity.passport, identity.homeCountry, setIdentity]);

  async function next() {
    setSaving(true);
    const { session, identity: current } = useSessionStore.getState();
    if (session) await saveIdentityToProfile(session.user.id, current).catch((e) => console.warn('Profil kaydedilemedi', e));
    setSaving(false);
    router.push('/companion');
  }

  return (
    <Screen footer={<Button title={t('common.continue')} disabled={!identity.passport} loading={saving} onPress={next} />}>
      <StepHeader step={1} total={4} title={t('identity.title')} subtitle={t('identity.subtitle')} />
      <IdentityForm value={identity} onChange={setIdentity} />
      <Text variant="caption" color="textMuted">
        {t('identity.disclaimer')}
      </Text>
    </Screen>
  );
}
