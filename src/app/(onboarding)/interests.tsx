import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { MIN_INTERESTS } from '@/features/profile/options';
import { InterestPicker } from '@/features/profile/preference-pickers';
import { savePreferencesToProfile } from '@/features/profile/save-preferences';
import { useSessionStore } from '@/stores/session-store';

export default function InterestsStep() {
  const { t } = useTranslation();
  const interests = useSessionStore((s) => s.preferences.interests);
  const setPreferences = useSessionStore((s) => s.setPreferences);
  const completeOnboarding = useSessionStore((s) => s.completeOnboarding);
  const [saving, setSaving] = useState(false);

  async function finish() {
    setSaving(true);
    const { session, preferences } = useSessionStore.getState();
    if (session) {
      // Sunucuya yazılamazsa da devam edilir; tercihler telefonda saklı ve bir
      // sonraki girişte verify ekranı tekrar eşitler.
      await savePreferencesToProfile(session.user.id, preferences).catch((e) =>
        console.warn('Tercihler kaydedilemedi', e),
      );
    }
    setSaving(false);
    completeOnboarding();
  }

  return (
    <Screen
      footer={
        <>
          <Button
            title={t('onboarding.finish')}
            disabled={interests.length < MIN_INTERESTS}
            loading={saving}
            onPress={finish}
          />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <StepHeader
        step={4}
        total={4}
        title={t('onboarding.interestsTitle')}
        subtitle={t('onboarding.interestsSubtitle')}
      />
      <InterestPicker value={interests} onChange={(v) => setPreferences({ interests: v })} />
    </Screen>
  );
}
