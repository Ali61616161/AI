import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { DestinationField, type Destination } from '@/features/trips/destination-field';
import { useCreateManualTrip, useTrips } from '@/features/trips/queries';
import { isDuplicateNameError, isDuplicateTripName } from '@/features/trips/trip-name';
import { normalizeAnswers } from '@/features/trips/trip-answers';
import { TripQuestions, useDefaultTripAnswers } from '@/features/trips/trip-questions';
import { useSessionStore } from '@/stores/session-store';

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Bilet yüklemeden seyahat oluşturma: şehir (ülkesiyle tek seçim) ve takvimden tarihler. */
export default function NewTripScreen() {
  const { t } = useTranslation();
  const create = useCreateManualTrip();
  const { data: trips } = useTrips();
  const userId = useSessionStore((s) => s.session?.user.id ?? s.userId);
  // Kaçamak ve Çark'tan gelindiğinde şehir, ülke ve tarihler hazır gelir.
  const prefill = useLocalSearchParams<{ city?: string; country?: string; start?: string; end?: string }>();
  const [destination, setDestination] = useState<Destination>({ city: prefill.city ?? '', country: prefill.country && /^[A-Z]{2}$/.test(prefill.country) ? prefill.country : null });
  const [start, setStart] = useState(prefill.start && DATE.test(prefill.start) ? prefill.start : '');
  const [end, setEnd] = useState(prefill.end && DATE.test(prefill.end) ? prefill.end : '');
  const [title, setTitle] = useState('');
  const defaults = useDefaultTripAnswers();
  const [answers, setAnswers] = useState(defaults);
  const [showErrors, setShowErrors] = useState(false);
  const normalized = useMemo(() => normalizeAnswers(answers), [answers]);
  const answerErrors = normalized.budgetError || normalized.hotelError !== null || normalized.timeError || normalized.flightError;
  const city = destination.city.trim();
  const country = destination.country;
  const datesValid = DATE.test(start) && DATE.test(end) && end >= start;
  const finalTitle = title.trim() || city;
  const duplicate = isDuplicateTripName(trips, finalTitle, userId);
  // Ülke acil durum numaraları, vize bilgisi ve ifade kitabı için gerekli.
  const valid = city.length > 1 && country !== null && datesValid && !duplicate;
  const serverDuplicate = create.isError && isDuplicateNameError(create.error);

  // Başlangıç değişince bitişten sonraya kalırsa bitiş temizlenir (geçersiz aralık oluşmasın).
  function changeStart(v: string) {
    setStart(v);
    if (end && v && end < v) setEnd('');
  }

  async function submit() {
    setShowErrors(true);
    if (answerErrors || !valid) return;
    const id = await create.mutateAsync({
      title: finalTitle,
      start,
      end,
      city,
      countryCode: country,
      companion: answers.companion,
      budget: normalized.budgetTier,
      interests: answers.interests,
      answers,
    });
    // Rota arka planda üretilir; tam ekran sayfa en az 10 sn gösterilir ve hazır seyahat doğrudan açılır.
    router.replace({ pathname: '/trip-building', params: { tripId: id } });
  }

  return (
    <Screen footer={<Button title={t('newTrip.create')} disabled={!valid} loading={create.isPending} onPress={submit} />}>
      <ModalHeader title={t('newTrip.title')} subtitle={t('newTrip.subtitle')} />
      <DestinationField value={destination} onChange={setDestination} />
      <DateField label={t('dates.start')} value={start} onChange={changeStart} />
      <DateField label={t('dates.end')} value={end} min={start || null} onChange={setEnd} error={DATE.test(start) && DATE.test(end) && end < start ? t('newTrip.endBeforeStart') : null} />
      <TextField
        label={t('newTrip.name')}
        value={title}
        onChangeText={setTitle}
        placeholder={city || t('newTrip.namePlaceholder')}
        error={duplicate || serverDuplicate ? t('newTrip.duplicateName') : null}
      />
      {create.isError && !serverDuplicate && (
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
