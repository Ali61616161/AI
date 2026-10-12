import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { flag } from '@/features/tools/emergency-numbers';
import { localCountryName } from '@/features/tools/countries';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { CONTINENTS, COUNTRIES_BY_CONTINENT, type Continent } from '../../../supabase/functions/_shared/continents.ts';

/** Gezilen ülkeleri seçme: kıta sekmeleri, arama ve dokununca işaretlenen bayraklı çipler. */
export function VisitedPicker({ value, onChange }: { value: string[]; onChange: (codes: string[]) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [continent, setContinent] = useState<Continent>('europe');
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const q = query.trim().toLocaleLowerCase(i18n.language);

  const list = useMemo(() => {
    const codes = q ? CONTINENTS.flatMap((c) => COUNTRIES_BY_CONTINENT[c]) : COUNTRIES_BY_CONTINENT[continent];
    return codes
      .map((code) => ({ code, name: localCountryName(code, i18n.language) }))
      .filter((c) => !q || c.name.toLocaleLowerCase(i18n.language).includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [continent, q, i18n.language]);

  function toggle(code: string) {
    onChange(selected.has(code) ? value.filter((c) => c !== code) : [...value, code]);
  }

  return (
    <View style={styles.wrap}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder={t('visited.search')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('visited.search')}
        style={[Typography.body, styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {!q && (
        <View style={styles.chips}>
          {CONTINENTS.map((c) => {
            const n = COUNTRIES_BY_CONTINENT[c].filter((code) => selected.has(code)).length;
            return <Chip key={c} label={`${t(`visited.continents.${c}`)}${n ? ` · ${n}` : ''}`} selected={continent === c} onPress={() => setContinent(c)} />;
          })}
        </View>
      )}
      <View style={styles.chips}>
        {list.map((c) => (
          <Chip key={c.code} icon={selected.has(c.code) ? 'checkmark-circle' : undefined} label={`${flag(c.code)} ${c.name}`} selected={selected.has(c.code)} onPress={() => toggle(c.code)} />
        ))}
      </View>
      {list.length === 0 && (
        <Text variant="caption" color="textMuted">
          {t('visited.noMatch')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  search: { height: 46, paddingHorizontal: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
});
