import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { StepHeader } from '@/components/ui/step-header';
import { pushVisited } from '@/features/travel/api';
import { VisitedCard } from '@/features/travel/visited-card';
import { VisitedPicker } from '@/features/travel/visited-picker';
import { useSessionStore } from '@/stores/session-store';

import { summarizeVisited } from '../../../supabase/functions/_shared/continents.ts';

/** Kayıt adımı 2 (isteğe bağlı): daha önce gezilen ülkeler; anında dünya yüzdesi. */
export default function VisitedStep() {
  const { t } = useTranslation();
  const visited = useSessionStore((s) => s.visitedCountries);
  const setVisited = useSessionStore((s) => s.setVisitedCountries);
  const summary = useMemo(() => summarizeVisited(visited), [visited]);

  function next() {
    pushVisited(useSessionStore.getState().visitedCountries).catch(() => undefined);
    router.push('/companion');
  }

  return (
    <Screen
      footer={
        <>
          <Button title={visited.length ? t('common.continue') : t('visited.skip')} variant={visited.length ? 'primary' : 'secondary'} onPress={next} />
          <Button title={t('common.back')} variant="ghost" onPress={() => router.back()} />
        </>
      }>
      <StepHeader step={2} total={5} title={t('visited.stepTitle')} subtitle={t('visited.stepSubtitle')} />
      {visited.length > 0 && <VisitedCard summary={summary} cities={null} />}
      <VisitedPicker value={visited} onChange={setVisited} />
    </Screen>
  );
}
