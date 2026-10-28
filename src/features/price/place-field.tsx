import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { searchCities, type PlaceHit } from './api';

type Value = { code: string; name: string } | null;

/** Şehir arama alanı: yazdıkça IATA şehir kodu önerir; seçilince şehir + kod gösterilir. */
export function PlaceField({ label, value, onChange }: { label: string; value: Value; onChange: (v: Value) => void }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const [term, setTerm] = useState('');
  // Sonuç, hangi arama metni için geldiğini taşır; metin değişince eski sonuç gösterilmez.
  const [result, setResult] = useState<{ term: string; hits: PlaceHit[]; failed: boolean } | null>(null);
  const query = term.trim();
  const current = result && result.term === query && query.length >= 2 ? result : null;
  const loading = query.length >= 2 && !current;
  const hits = current?.hits ?? [];
  const failed = current?.failed ?? false;

  useEffect(() => {
    if (query.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchCities(query, i18n.language, controller.signal)
        .then((found) => !controller.signal.aborted && setResult({ term: query, hits: found, failed: false }))
        .catch(() => !controller.signal.aborted && setResult({ term: query, hits: [], failed: true }));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, i18n.language]);

  if (value) {
    return (
      <View style={styles.wrap}>
        <Text variant="overline" color="textMuted">
          {label}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('priceWatch.change', { place: value.name })}
          onPress={() => {
            onChange(null);
            setTerm('');
          }}
          style={[styles.picked, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="bodyStrong" style={styles.flex}>
            {value.name} · {value.code}
          </Text>
          <Ionicons name="close-circle" size={20} color={colors.textMuted} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <TextField label={label} value={term} onChangeText={setTerm} placeholder={t('priceWatch.searchCity')} autoCapitalize="words" autoCorrect={false} />
      {loading && <ActivityIndicator />}
      {failed && (
        <Text variant="caption" color="danger">
          {t('priceWatch.searchFailed')}
        </Text>
      )}
      {hits.map((h) => (
        <Pressable
          key={h.code}
          accessibilityRole="button"
          onPress={() => {
            onChange({ code: h.code, name: h.name });
            setTerm('');
            setResult(null);
          }}
          style={[styles.hit, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="bodyStrong" style={styles.flex}>
            {h.name}
            {h.country ? ` · ${h.country}` : ''}
          </Text>
          <Text variant="caption" color="textMuted">
            {h.code}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  flex: { flex: 1 },
  picked: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  hit: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
});
