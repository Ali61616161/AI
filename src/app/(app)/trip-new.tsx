import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { COUNTRIES, localCountryName } from '@/features/tools/countries';
import { flag } from '@/features/tools/emergency-numbers';
import { useCreateManualTrip } from '@/features/trips/queries';
import { useSessionStore } from '@/stores/session-store';
import { Spacing } from '@/theme/tokens';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Bilet yüklemeden seyahat oluşturma: şehir, ülke ve tarihler. */
export default function NewTripScreen() {
  const { t, i18n } = useTranslation();
  const preferences = useSessionStore((s) => s.preferences);
  const create = useCreateManualTrip();
  const [city, setCity] = useState('');
  const [country, setCountry] = useState<string | null>(null);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [title, setTitle] = useState('');
  const options = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: `${flag(c.code)}  ${localCountryName(c.code, i18n.language)}` })).sort((a, b) => a.label.slice(4).localeCompare(b.label.slice(4), i18n.language)),
    [i18n.language],
  );
  const datesValid = DATE.test(start) && DATE.test(end) && end >= start;
  const valid = city.trim().length > 1 && datesValid;

  async function submit() {
    const id = await create.mutateAsync({
      title: title.trim() || city.trim(),
      start,
      end,
      city: city.trim(),
      countryCode: country,
      companion: preferences.companion ?? 'solo',
      budget: preferences.budget ?? 'mid',
      interests: preferences.interests,
    });
    router.replace({ pathname: '/trip/[id]', params: { id } });
  }

  return (
    <Screen footer={<Button title={t('newTrip.create')} disabled={!valid} loading={create.isPending} onPress={submit} />}>
      <ModalHeader title={t('newTrip.title')} subtitle={t('newTrip.subtitle')} />
      <TextField label={t('newTrip.city')} value={city} onChangeText={setCity} placeholder="Roma" autoCapitalize="words" />
      <View style={styles.field}>
        <Text variant="caption" color="textSecondary">
          {t('newTrip.country')}
        </Text>
        <SelectSheet label={t('newTrip.country')} value={country} options={options} placeholder={t('visa.choose')} onChange={setCountry} />
      </View>
      <TextField label={t('dates.start')} value={start} onChangeText={setStart} hint={t('dates.hint')} keyboardType="numbers-and-punctuation" maxLength={10} />
      <TextField
        label={t('dates.end')}
        value={end}
        onChangeText={setEnd}
        keyboardType="numbers-and-punctuation"
        maxLength={10}
        error={DATE.test(start) && DATE.test(end) && end < start ? t('newTrip.endBeforeStart') : null}
      />
      <TextField label={t('newTrip.name')} value={title} onChangeText={setTitle} placeholder={city || t('newTrip.namePlaceholder')} />
      {create.isError && (
        <Text variant="caption" color="danger">
          {t('common.error')}
        </Text>
      )}
      <Text variant="caption" color="textMuted">
        {t('newTrip.hint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ field: { gap: Spacing.xs } });
