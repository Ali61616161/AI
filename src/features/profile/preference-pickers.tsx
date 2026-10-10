import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { OptionCard } from '@/components/ui/option-card';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { BUDGETS, COMPANIONS, INTERESTS, type BudgetTier, type Companion } from './options';

export function CompanionPicker({ value, onChange }: { value: Companion | null; onChange: (v: Companion) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.list}>
      {COMPANIONS.map((c) => (
        <OptionCard
          key={c.value}
          icon={c.icon}
          title={t(`companion.${c.value}`)}
          description={t(`companion.${c.value}_desc`)}
          selected={value === c.value}
          onPress={() => onChange(c.value)}
        />
      ))}
    </View>
  );
}

export function BudgetPicker({ value, onChange }: { value: BudgetTier | null; onChange: (v: BudgetTier) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.list}>
      {BUDGETS.map((b) => (
        <OptionCard
          key={b.value}
          icon={b.icon}
          title={t(`budget.${b.value}`)}
          description={t(`budget.${b.value}_desc`)}
          accent={colors[b.color]}
          selected={value === b.value}
          onPress={() => onChange(b.value)}
        />
      ))}
    </View>
  );
}

export function InterestPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const { t } = useTranslation();
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <View style={styles.chips}>
      {INTERESTS.map((i) => (
        <Chip
          key={i.value}
          icon={i.icon}
          label={t(`interest.${i.value}` as 'interest.art')}
          selected={value.includes(i.value)}
          onPress={() => toggle(i.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
