import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { openBookingLink } from '@/features/places/api';
import { localCountryName } from '@/features/tools/countries';
import { useProfileCountries } from '@/features/tools/api';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { ESIM_NAMES, esimOptions, templatesFromPublicEnv } from './links';

// Expo yalnızca doğrudan `process.env.EXPO_PUBLIC_…` yazımını pakete gömer.
const TEMPLATES = templatesFromPublicEnv({
  EXPO_PUBLIC_AFFILIATE_AIRALO: process.env.EXPO_PUBLIC_AFFILIATE_AIRALO,
  EXPO_PUBLIC_AFFILIATE_HOLAFLY: process.env.EXPO_PUBLIC_AFFILIATE_HOLAFLY,
  EXPO_PUBLIC_AFFILIATE_SAILY: process.env.EXPO_PUBLIC_AFFILIATE_SAILY,
});

/** Yurt dışı seyahatlerde eSIM: varış ülkesi için veri paketi sağlayıcıları (roaming yerine). */
export function EsimCard({ countryCodes }: { countryCodes: (string | null)[] }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { data: profile } = useProfileCountries();
  const home = profile?.home_country ?? null;
  const countries = [...new Set(countryCodes.filter((c): c is string => Boolean(c)).map((c) => c.toUpperCase()))].filter((c) => c !== home).slice(0, 4);
  const [picked, setPicked] = useState<string | null>(null);
  if (countries.length === 0) return null;

  const country = picked && countries.includes(picked) ? picked : countries[0];
  const options = esimOptions(country, TEMPLATES);
  const name = localCountryName(country, i18n.language);

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Ionicons name="cellular-outline" size={20} color={colors.primary} />
        <Text variant="subtitle" style={styles.flex}>
          {t('esim.title')}
        </Text>
      </View>
      <Text variant="caption" color="textSecondary">
        {t('esim.body', { country: name })}
      </Text>
      {countries.length > 1 && (
        <View style={styles.chips}>
          {countries.map((c) => (
            <Chip key={c} label={localCountryName(c, i18n.language)} selected={c === country} onPress={() => setPicked(c)} />
          ))}
        </View>
      )}
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={o.provider} icon="open-outline" label={ESIM_NAMES[o.provider]} onPress={() => openBookingLink(o.url)} />
        ))}
      </View>
      <Text variant="caption" color="textMuted">
        {options.some((o) => o.affiliate) ? t('esim.affiliateNote') : t('esim.note')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
