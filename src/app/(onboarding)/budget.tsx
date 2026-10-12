import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { BudgetPicker } from '@/features/profile/preference-pickers';
import { useSessionStore } from '@/stores/session-store';

export default function BudgetStep() {
  const { t } = useTranslation();
  const budget = useSessionStore((s) => s.preferences.budget);
  const setPreferences = useSessionStore((s) => s.setPreferences);

  return (
    <Screen
      footer={
        <>
          <Button title={t('common.continue')} disabled={!budget} onPress={() => router.push('/interests')} />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <StepHeader step={4} total={5} title={t('onboarding.budgetTitle')} subtitle={t('onboarding.budgetSubtitle')} />
      <BudgetPicker value={budget} onChange={(v) => setPreferences({ budget: v })} />
    </Screen>
  );
}
