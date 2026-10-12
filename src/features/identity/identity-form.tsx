import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { getCurrentLocation } from '@/features/plan/replan';
import type { TravelIdentity } from '@/stores/session-store';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { useCountryOptions } from './country-options';
import { VISA_GROUPS } from './extra-visas';
import { PassportCard } from './passport-card';
import { usePassportPower } from './use-passport-power';

const MAX_OTHER_PASSPORTS = 3;

/** Vatandaşlık, ek pasaportlar, ek vizeler ve yaşanan şehir. Kayıt adımında ve profilde kullanılır. */
export function IdentityForm({ value, onChange }: { value: TravelIdentity; onChange: (patch: Partial<TravelIdentity>) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const countries = useCountryOptions();
  const power = usePassportPower(value);
  const [locating, setLocating] = useState(false);
  const [locateFailed, setLocateFailed] = useState(false);
  const passports = [value.passport, ...value.otherPassports].filter((p): p is string => !!p);

  function toggleVisa(key: string) {
    onChange({ extraVisas: value.extraVisas.includes(key) ? value.extraVisas.filter((k) => k !== key) : [...value.extraVisas, key] });
  }

  async function fillFromLocation() {
    setLocating(true);
    setLocateFailed(false);
    try {
      const c = await getCurrentLocation();
      if (!c) throw new Error('no location');
      const [place] = await Location.reverseGeocodeAsync({ latitude: c.lat, longitude: c.lng });
      const city = place?.city ?? place?.subregion ?? place?.region ?? null;
      if (!city) throw new Error('no city');
      onChange({ homeCity: city, homeCountry: place?.isoCountryCode ?? value.homeCountry, homeLat: c.lat, homeLng: c.lng });
    } catch {
      setLocateFailed(true);
    } finally {
      setLocating(false);
    }
  }

  return (
    <View style={styles.form}>
      <View style={styles.group}>
        <Text variant="subtitle">{t('identity.citizenship')}</Text>
        <SelectSheet label={t('identity.citizenship')} value={value.passport} options={countries} placeholder={t('identity.choose')} onChange={(c) => onChange({ passport: c, otherPassports: value.otherPassports.filter((p) => p !== c) })} />
        {value.otherPassports.map((p, i) => (
          <View key={`${p}-${i}`} style={styles.row}>
            <View style={styles.flex}>
              <SelectSheet
                label={t('identity.otherCitizenship')}
                value={p}
                options={countries.filter((o) => o.value !== value.passport)}
                placeholder={t('identity.choose')}
                onChange={(c) => onChange({ otherPassports: value.otherPassports.map((x, j) => (j === i ? c : x)) })}
              />
            </View>
            <Tap accessibilityRole="button" accessibilityLabel={t('identity.removeCitizenship')} onPress={() => onChange({ otherPassports: value.otherPassports.filter((_, j) => j !== i) })} hitSlop={10}>
              <Ionicons name="close-circle" size={26} color={colors.textMuted} />
            </Tap>
          </View>
        ))}
        {value.passport && value.otherPassports.length < MAX_OTHER_PASSPORTS && (
          <Button
            title={t('identity.addCitizenship')}
            variant="ghost"
            icon="add"
            onPress={() => {
              const first = countries.find((o) => o.value !== value.passport && !value.otherPassports.includes(o.value));
              if (first) onChange({ otherPassports: [...value.otherPassports, first.value] });
            }}
          />
        )}
      </View>

      <View style={styles.group}>
        <Text variant="subtitle">{t('identity.extraVisas')}</Text>
        <Text variant="caption" color="textSecondary">
          {t('identity.extraVisasHint')}
        </Text>
        {VISA_GROUPS.map((g) => (
          <View key={g.key} style={styles.group}>
            <Text variant="overline" color="textMuted">
              {t(`identity.group.${g.key}`)}
            </Text>
            <View style={styles.chips}>
              {g.items.map((v) => (
                <Chip key={v.key} label={`${v.flag} ${t(`visaType.${v.key}`)}`} selected={value.extraVisas.includes(v.key)} onPress={() => toggleVisa(v.key)} />
              ))}
            </View>
          </View>
        ))}
      </View>

      {power && <PassportCard passports={passports} power={power} />}

      <View style={styles.group}>
        <Text variant="subtitle">{t('identity.homeCity')}</Text>
        <Text variant="caption" color="textSecondary">
          {t('identity.homeCityHint')}
        </Text>
        <TextField
          label={t('identity.homeCity')}
          placeholder={t('identity.homeCityPlaceholder')}
          value={value.homeCity ?? ''}
          // Elle yazılan şehirde koordinat sunucuda bulunur.
          onChangeText={(v) => onChange({ homeCity: v.trimStart() ? v : null, homeLat: null, homeLng: null })}
          autoCapitalize="words"
          error={locateFailed ? t('identity.locateFailed') : null}
        />
        {value.homeCity && (
          <SelectSheet label={t('identity.homeCountry')} value={value.homeCountry} options={countries} placeholder={t('identity.homeCountry')} onChange={(c) => onChange({ homeCountry: c })} />
        )}
        {Platform.OS !== 'web' && <Button title={t('identity.useLocation')} variant="secondary" icon="locate" loading={locating} onPress={fillFromLocation} />}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.xl },
  group: { gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
});
