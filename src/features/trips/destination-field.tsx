import Ionicons from '@expo/vector-icons/Ionicons';
import * as Crypto from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { pickCityById, suggestCities, type CitySuggestion } from '@/features/places/api';
import { COUNTRIES, localCountryName } from '@/features/tools/countries';
import { flag } from '@/features/tools/emergency-numbers';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

export type Destination = { city: string; country: string | null };

/**
 * Tek alandan şehir seçimi: yazdıkça Google şehir önerir, seçince ülke de otomatik gelir. Öneri çıkmazsa
 * ("Listede yok mu?") şehir ve ülke elle girilebilir.
 */
export function DestinationField({ value, onChange }: { value: Destination; onChange: (v: Destination) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [term, setTerm] = useState('');
  const [result, setResult] = useState<{ term: string; cities: CitySuggestion[]; failed: boolean } | null>(null);
  const [manual, setManual] = useState(false);
  const [picking, setPicking] = useState(false);
  const session = useRef(Crypto.randomUUID().replace(/-/g, ''));
  const query = term.trim();
  const current = result && result.term === query && query.length >= 2 ? result : null;
  const loading = !manual && query.length >= 2 && !current;
  const chosen = value.city !== '' && value.country !== null && !manual;

  useEffect(() => {
    if (manual || chosen || query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      suggestCities(query, session.current)
        .then((cities) => !cancelled && setResult({ term: query, cities, failed: false }))
        .catch(() => !cancelled && setResult({ term: query, cities: [], failed: true }));
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, manual, chosen]);

  async function choose(s: CitySuggestion) {
    setPicking(true);
    try {
      const city = await pickCityById(s.place_id, session.current);
      onChange({ city: city.name, country: city.country_code });
      setTerm('');
      setResult(null);
      session.current = Crypto.randomUUID().replace(/-/g, '');
    } catch {
      setResult({ term: query, cities: [], failed: true });
    } finally {
      setPicking(false);
    }
  }

  if (manual) {
    const options = COUNTRIES.map((c) => ({ value: c.code, label: `${flag(c.code)}  ${localCountryName(c.code, i18n.language)}` })).sort((a, b) => a.label.slice(4).localeCompare(b.label.slice(4), i18n.language));
    return (
      <View style={styles.wrap}>
        <TextField label={t('newTrip.city')} value={value.city} onChangeText={(city) => onChange({ ...value, city })} placeholder="Roma" autoCapitalize="words" />
        <Text variant="overline" color="textMuted">
          {t('newTrip.country')}
        </Text>
        <SelectSheet label={t('newTrip.country')} value={value.country} options={options} placeholder={t('visa.choose')} onChange={(country) => onChange({ ...value, country })} />
        <Text variant="caption" color="textMuted">
          {t('newTrip.countryWhy')}
        </Text>
        <Pressable accessibilityRole="button" onPress={() => { setManual(false); onChange({ city: '', country: null }); }}>
          <Text variant="caption" color="primary">
            {t('newTrip.useSearch')}
          </Text>
        </Pressable>
      </View>
    );
  }

  if (chosen) {
    return (
      <View style={styles.wrap}>
        <Text variant="overline" color="textMuted">
          {t('newTrip.destination')}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('newTrip.changeDestination', { place: value.city })}
          onPress={() => onChange({ city: '', country: null })}
          style={[styles.picked, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="bodyStrong" style={styles.flex}>
            {flag(value.country!)}  {value.city} · {localCountryName(value.country!, i18n.language)}
          </Text>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TextField label={t('newTrip.destination')} value={term} onChangeText={setTerm} placeholder={t('newTrip.searchPlaceholder')} autoCapitalize="words" autoCorrect={false} />
      {(loading || picking) && <ActivityIndicator />}
      {current?.cities.map((c) => (
        <Pressable key={c.place_id} accessibilityRole="button" disabled={picking} onPress={() => choose(c)} style={[styles.hit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="bodyStrong" style={styles.flex}>
            {c.name}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.detail}>
            {c.detail}
          </Text>
        </Pressable>
      ))}
      {current && current.cities.length === 0 && (
        <Text variant="caption" color={current.failed ? 'danger' : 'textMuted'}>
          {current.failed ? t('newTrip.searchFailed') : t('newTrip.noResults')}
        </Text>
      )}
      <Pressable accessibilityRole="button" onPress={() => { setManual(true); onChange({ city: term.trim(), country: null }); }}>
        <Text variant="caption" color="primary">
          {t('newTrip.enterManually')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  flex: { flex: 1 },
  detail: { maxWidth: '55%' },
  picked: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
});
