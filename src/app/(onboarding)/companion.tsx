import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { CompanionPicker } from '@/features/profile/preference-pickers';
import { useSessionStore } from '@/stores/session-store';

export default function CompanionStep() {
  const { t } = useTranslation();
  const companion = useSessionStore((s) => s.preferences.companion);
  const setPreferences = useSessionStore((s) => s.setPreferences);

  return (
    <Screen
      footer={
        <Button title={t('common.continue')} disabled={!companion} onPress={() => router.push('/budget')} />
      }>
      <StepHeader
        step={3}
        total={5}
        title={t('onboarding.companionTitle')}
        subtitle={t('onboarding.companionSubtitle')}
      />
      <CompanionPicker value={companion} onChange={(v) => setPreferences({ companion: v })} />
    </Screen>
  );
}
