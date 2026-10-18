import { router, useLocalSearchParams } from 'expo-router';
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
import { normalizeAnswers } from '@/features/trips/trip-answers';
import { TripQuestions, useDefaultTripAnswers } from '@/features/trips/trip-questions';
import { Spacing } from '@/theme/tokens';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Bilet yüklemeden seyahat oluşturma: şehir, ülke ve tarihler. */
export default function NewTripScreen() {
  const { t, i18n } = useTranslation();
  const create = useCreateManualTrip();
  // Kaçamak ve Çark'tan gelindiğinde şehir, ülke ve tarihler hazır gelir.
  const prefill = useLocalSearchParams<{ city?: string; country?: string; start?: string; end?: string }>();
  const [city, setCity] = useState(prefill.city ?? '');
  const [country, setCountry] = useState<string | null>(prefill.country && /^[A-Z]{2}$/.test(prefill.country) ? prefill.country : null);
  const [start, setStart] = useState(prefill.start && DATE.test(prefill.start) ? prefill.start : '');
  const [end, setEnd] = useState(prefill.end && DATE.test(prefill.end) ? prefill.end : '');
  const [title, setTitle] = useState('');
  const defaults = useDefaultTripAnswers();
  const [answers, setAnswers] = useState(defaults);
  const [showErrors, setShowErrors] = useState(false);
  const normalized = useMemo(() => normalizeAnswers(answers), [answers]);
  const answerErrors = normalized.budgetError || normalized.hotelError !== null;
  const options = useMemo(
    () => COUNTRIES.map((c) => ({ value: c.code, label: `${flag(c.code)}  ${localCountryName(c.code, i18n.language)}` })).sort((a, b) => a.label.slice(4).localeCompare(b.label.slice(4), i18n.language)),
    [i18n.language],
  );
  const datesValid = DATE.test(start) && DATE.test(end) && end >= start;
  // Ülke acil durum numaraları, vize bilgisi ve ifade kitabı için gerekli.
  const valid = city.trim().length > 1 && country !== null && datesValid;

  async function submit() {
    setShowErrors(true);
    if (answerErrors) return;
    const id = await create.mutateAsync({
      title: title.trim() || city.trim(),
      start,
      end,
      city: city.trim(),
      countryCode: country,
      companion: answers.companion,
      budget: normalized.budgetTier,
      interests: answers.interests,
      answers,
    });
    router.replace({ pathname: '/trip/[id]', params: { id } });
  }

  return (
    <Screen footer={<Button title={t('newTrip.create')} disabled={!valid} loading={create.isPending} onPress={submit} />}>
      <ModalHeader title={t('newTrip.title')} subtitle={t('newTrip.subtitle')} />
      <TextField label={t('newTrip.city')} value={city} onChangeText={setCity} placeholder="Roma" autoCapitalize="words" />
      <View style={styles.field}>
        <Text variant="overline" color="textMuted">
          {t('newTrip.country')}
        </Text>
        <SelectSheet label={t('newTrip.country')} value={country} options={options} placeholder={t('visa.choose')} onChange={setCountry} />
        {!country && (
          <Text variant="caption" color="textMuted">
            {t('newTrip.countryWhy')}
          </Text>
        )}
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
      <TripQuestions value={answers} onChange={setAnswers} tripStart={DATE.test(start) ? start : null} tripEnd={DATE.test(end) ? end : null} errors={showErrors ? normalized : null} />
      <Text variant="caption" color="textMuted">
        {t('newTrip.hint')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({ field: { gap: Spacing.xs } });
