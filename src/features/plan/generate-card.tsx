import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const STEPS = ['plan.generating1', 'plan.generating2', 'plan.generating3'] as const;

/** Rota yokken gösterilen kart; üretim sürerken adım adım ilerleme mesajı gösterir. */
export function GenerateCard({ pending, error, onGenerate }: { pending: boolean; error: string | null; onGenerate: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 6000);
    return () => clearInterval(id);
  }, [pending]);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        {pending ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="sparkles" size={26} color={colors.primary} />}
      </View>
      <Text variant="subtitle" style={styles.center}>
        {pending ? t(STEPS[step]) : t('plan.emptyTitle')}
      </Text>
      <Text variant="body" color="textSecondary" style={styles.center}>
        {pending ? t('plan.generatingHint') : t('plan.emptyBody')}
      </Text>
      {error && (
        <Text variant="caption" color="danger" style={styles.center}>
          {error}
        </Text>
      )}
      {!pending && (
        <Button
          title={t('plan.generate')}
          onPress={() => {
            setStep(0);
            onGenerate();
          }}
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: Spacing.md, padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1 },
  icon: { width: 64, height: 64, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  button: { alignSelf: 'stretch' },
});
