import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { MIN_INTERESTS } from '@/features/profile/options';
import { BudgetPicker, CompanionPicker, InterestPicker } from '@/features/profile/preference-pickers';
import { savePreferencesToProfile } from '@/features/profile/save-preferences';
import { useSessionStore, type TravelPreferences } from '@/stores/session-store';
import { Spacing } from '@/theme/tokens';

/** Profilden açılan tercih düzenleme ekranı. Değişiklikler "Kaydet"e basınca uygulanır. */
export default function PreferencesScreen() {
  const { t } = useTranslation();
  const stored = useSessionStore((s) => s.preferences);
  const setPreferences = useSessionStore((s) => s.setPreferences);
  const [draft, setDraft] = useState<TravelPreferences>(stored);
  const [saving, setSaving] = useState(false);

  const valid = Boolean(draft.companion && draft.budget && draft.interests.length >= MIN_INTERESTS);

  async function save() {
    setSaving(true);
    setPreferences(draft);
    const session = useSessionStore.getState().session;
    if (session) {
      await savePreferencesToProfile(session.user.id, draft).catch((e) => console.warn('Tercihler kaydedilemedi', e));
    }
    setSaving(false);
    router.back();
  }

  return (
    <Screen footer={<Button title={t('common.save')} onPress={save} disabled={!valid} loading={saving} />}>
      <ModalHeader title={t('profile.editPreferences')} />
      <View style={styles.section}>
        <Text variant="subtitle">{t('onboarding.companionTitle')}</Text>
        <CompanionPicker value={draft.companion} onChange={(companion) => setDraft((d) => ({ ...d, companion }))} />
      </View>
      <View style={styles.section}>
        <Text variant="subtitle">{t('onboarding.budgetTitle')}</Text>
        <BudgetPicker value={draft.budget} onChange={(budget) => setDraft((d) => ({ ...d, budget }))} />
      </View>
      <View style={styles.section}>
        <Text variant="subtitle">{t('onboarding.interestsTitle')}</Text>
        <InterestPicker value={draft.interests} onChange={(interests) => setDraft((d) => ({ ...d, interests }))} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.md },
});
