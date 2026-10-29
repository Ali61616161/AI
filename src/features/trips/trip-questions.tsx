import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { Text } from '@/components/ui/text';
import { DateField, TimeField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { BUDGETS, COMPANIONS, INTERESTS } from '@/features/profile/options';
import { useSessionStore } from '@/stores/session-store';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { emptyHotel, isBlankOrClock, MAX_HOTELS, NOTES_MAX, type LocalTransport, type NormalizedAnswers, type TripAnswers } from './trip-answers';

const TRANSPORTS: { value: LocalTransport; icon: 'train-outline' | 'car-outline' | 'swap-horizontal-outline' }[] = [
  { value: 'transit', icon: 'train-outline' },
  { value: 'car', icon: 'car-outline' },
  { value: 'mixed', icon: 'swap-horizontal-outline' },
];

/** Varsayılan cevaplar: profildeki tercihler; para birimi cihazın yerel para birimi. */
type TimeFieldsValue = Pick<TripAnswers, 'arrivalTime' | 'arrivalAirport' | 'departureTime' | 'departureAirport'>;

/** Gidilen ülkeye iniş / dönüş uçuşu saati ve havalimanı alanları (hepsi isteğe bağlı). */
export function TripTimeFields({ value, onChange, timeError }: { value: TimeFieldsValue; onChange: (patch: Partial<TimeFieldsValue>) => void; timeError: boolean }) {
  const { t } = useTranslation();
  const bad = (v: string) => (timeError && !isBlankOrClock(v) ? t('tripQuestions.timeInvalid') : null);
  return (
    <View style={styles.section}>
      <View style={styles.timeRow}>
        <View style={styles.timeCol}>
          <TimeField label={t('tripQuestions.arrivalTime')} value={value.arrivalTime} onChange={(arrivalTime) => onChange({ arrivalTime })} error={bad(value.arrivalTime)} />
        </View>
        <View style={styles.timeCol}>
          <TimeField label={t('tripQuestions.departureTime')} value={value.departureTime} onChange={(departureTime) => onChange({ departureTime })} error={bad(value.departureTime)} />
        </View>
      </View>
      <TextField label={t('tripQuestions.arrivalAirport')} value={value.arrivalAirport} onChangeText={(arrivalAirport) => onChange({ arrivalAirport })} placeholder={t('tripQuestions.airportPlaceholder')} maxLength={120} />
      <TextField label={t('tripQuestions.departureAirport')} value={value.departureAirport} onChangeText={(departureAirport) => onChange({ departureAirport })} placeholder={t('tripQuestions.airportPlaceholder')} maxLength={120} />
    </View>
  );
}

export function useDefaultTripAnswers(): TripAnswers {
  const preferences = useSessionStore((s) => s.preferences);
  return {
    companion: preferences.companion ?? 'solo',
    budget: preferences.budget ?? 'mid',
    dailyBudget: '',
    currency: getLocales()[0]?.currencyCode ?? 'USD',
    interests: preferences.interests,
    transport: 'mixed',
    notes: '',
    hotels: [],
    arrivalTime: '',
    arrivalAirport: '',
    departureTime: '',
    departureAirport: '',
  };
}

type Props = {
  value: TripAnswers;
  onChange: (next: TripAnswers) => void;
  /** Otel tarihlerinin varsayılanı olarak ipucu gösterilen seyahat tarihleri. */
  tripStart?: string | null;
  tripEnd?: string | null;
  /** normalizeAnswers çıktısındaki hatalar (gönder'e basılınca gösterilir). */
  errors?: Pick<NormalizedAnswers, 'hotelError' | 'budgetError' | 'timeError'> | null;
};

/**
 * Seyahate özel isteğe bağlı sorular: kiminle, bütçe ("Diğer" ile rakam), ilgi alanları, şehir içi
 * ulaşım, oteller ve serbest not. Doldurulmayanlar profildeki tercihlerle devam eder.
 */
export function TripQuestions({ value, onChange, tripStart, tripEnd, errors }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const set = (patch: Partial<TripAnswers>) => onChange({ ...value, ...patch });
  const toggleInterest = (i: string) => set({ interests: value.interests.includes(i) ? value.interests.filter((x) => x !== i) : [...value.interests, i] });
  const setHotel = (index: number, patch: Partial<TripAnswers['hotels'][number]>) => set({ hotels: value.hotels.map((h, i) => (i === index ? { ...h, ...patch } : h)) });

  return (
    <View style={styles.wrap}>
      <View style={styles.section}>
        <Text variant="subtitle">{t('tripQuestions.title')}</Text>
        <Text variant="caption" color="textSecondary">
          {t('tripQuestions.subtitle')}
        </Text>
      </View>

      <Group label={t('tripQuestions.companion')}>
        {COMPANIONS.map((c) => (
          <Chip key={c.value} icon={c.icon} label={t(`companion.${c.value}`)} selected={value.companion === c.value} onPress={() => set({ companion: c.value })} />
        ))}
      </Group>

      <Group label={t('tripQuestions.budget')}>
        {BUDGETS.map((b) => (
          <Chip key={b.value} icon={b.icon} label={t(`budget.${b.value}`)} selected={value.budget === b.value} onPress={() => set({ budget: b.value })} />
        ))}
        <Chip icon="create-outline" label={t('tripQuestions.budgetOther')} selected={value.budget === 'custom'} onPress={() => set({ budget: 'custom' })} />
      </Group>
      {value.budget === 'custom' && (
        <View style={styles.row}>
          <View style={styles.flex}>
            <TextField
              label={t('tripQuestions.dailyBudget')}
              value={value.dailyBudget}
              onChangeText={(dailyBudget) => set({ dailyBudget })}
              keyboardType="decimal-pad"
              placeholder="120"
              hint={t('tripQuestions.dailyBudgetHint')}
              error={errors?.budgetError ? t('tripQuestions.budgetInvalid') : null}
            />
          </View>
          <View style={styles.currency}>
            <TextField label={t('tripQuestions.currency')} value={value.currency} onChangeText={(c) => set({ currency: c.toUpperCase().slice(0, 3) })} autoCapitalize="characters" maxLength={3} />
          </View>
        </View>
      )}

      <Group label={t('tripQuestions.transport')}>
        {TRANSPORTS.map((x) => (
          <Chip key={x.value} icon={x.icon} label={t(`tripQuestions.transports.${x.value}`)} selected={value.transport === x.value} onPress={() => set({ transport: x.value })} />
        ))}
      </Group>

      <Group label={t('tripQuestions.interests')}>
        {INTERESTS.map((i) => (
          <Chip key={i.value} icon={i.icon} label={t(`interest.${i.value}` as 'interest.art')} selected={value.interests.includes(i.value)} onPress={() => toggleInterest(i.value)} />
        ))}
      </Group>

      <View style={styles.section}>
        <Text variant="overline" color="textMuted">
          {t('tripQuestions.hotels')}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('tripQuestions.hotelsHint')}
        </Text>
        {value.hotels.map((h, index) => {
          const error = errors?.hotelError?.index === index ? errors.hotelError.issue : null;
          return (
            <View key={index} style={[styles.hotel, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <View style={styles.row}>
                <Ionicons name="bed-outline" size={18} color={colors.primary} />
                <Text variant="bodyStrong" style={styles.flex}>
                  {t('tripQuestions.hotel', { n: index + 1 })}
                </Text>
                <Button title={t('tripQuestions.removeHotel')} variant="ghost" size="sm" onPress={() => set({ hotels: value.hotels.filter((_, i) => i !== index) })} />
              </View>
              <TextField label={t('tripQuestions.hotelName')} value={h.name} onChangeText={(name) => setHotel(index, { name })} error={error === 'name' ? t('tripQuestions.hotelNameRequired') : null} />
              <TextField label={t('tripQuestions.hotelAddress')} value={h.address} onChangeText={(address) => setHotel(index, { address })} />
              <View style={styles.row}>
                <View style={styles.flex}>
                  <DateField label={t('tripQuestions.checkIn')} value={h.checkIn} optional min={tripStart} max={tripEnd} onChange={(checkIn) => setHotel(index, { checkIn })} />
                </View>
                <View style={styles.flex}>
                  <DateField label={t('tripQuestions.checkOut')} value={h.checkOut} optional min={h.checkIn || tripStart} max={tripEnd} onChange={(checkOut) => setHotel(index, { checkOut })} error={error === 'dates' ? t('tripQuestions.hotelDatesInvalid') : null} />
                </View>
              </View>
            </View>
          );
        })}
        {value.hotels.length < MAX_HOTELS && <Button title={t('tripQuestions.addHotel')} variant="secondary" icon="add" onPress={() => set({ hotels: [...value.hotels, emptyHotel()] })} />}
      </View>

      <View style={styles.section}>
        <Text variant="subtitle">{t('tripQuestions.flightTimesTitle')}</Text>
        <Text variant="caption" color="textSecondary">
          {t('tripQuestions.flightTimesHint')}
        </Text>
        <TripTimeFields value={value} onChange={set} timeError={errors?.timeError ?? false} />
      </View>

      <TextField
        label={t('tripQuestions.notes')}
        value={value.notes}
        onChangeText={(notes) => set({ notes: notes.slice(0, NOTES_MAX) })}
        placeholder={t('tripQuestions.notesPlaceholder')}
        hint={t('tripQuestions.notesCount', { count: value.notes.length, max: NOTES_MAX })}
        multiline
        maxLength={NOTES_MAX}
        style={styles.notes}
      />
    </View>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="overline" color="textMuted">
        {label}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.lg },
  section: { gap: Spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  currency: { width: 96 },
  hotel: { gap: Spacing.md, padding: Spacing.md, borderRadius: 16, borderWidth: 1 },
  notes: { minHeight: 140, textAlignVertical: 'top' },
  timeRow: { flexDirection: 'row', gap: Spacing.md },
  timeCol: { flex: 1 },
});
