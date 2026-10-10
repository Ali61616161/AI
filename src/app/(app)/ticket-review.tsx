import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { buildTripDraft, type DraftItem } from '@/features/documents/build-trip';
import { RESERVATION_ICONS, TRANSPORT_TYPES } from '@/features/documents/reservation-icons';
import { useUploadStore } from '@/features/documents/upload-store';
import { useCreateTripFromDocuments } from '@/features/trips/queries';
import { formatDateRange } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import {
  LOW_CONFIDENCE,
  normalizeLocalDateTime,
  type Endpoint,
} from '../../../supabase/functions/_shared/documents.ts';

/** "2026-11-01T14:30" ↔ "2026-11-01 14:30": kullanıcıya T harfini göstermiyoruz. */
const toInput = (local: string | null | undefined) => (local ? local.replace('T', ' ') : '');

type DateField = 'start' | 'end';

function ItemCard({
  item,
  included,
  dateErrors,
  onDateText,
}: {
  item: DraftItem;
  included: boolean;
  dateErrors: Partial<Record<DateField, boolean>>;
  onDateText: (field: DateField, text: string) => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { updateItem, toggleItem } = useUploadStore();
  const transport = TRANSPORT_TYPES.includes(item.type);
  const low = (key: string) => (item.confidence[key] !== undefined && item.confidence[key] < LOW_CONFIDENCE ? t('review.lowConfidence') : null);
  const [dates, setDates] = useState({ start: toInput(item.start.local_datetime), end: toInput(item.end?.local_datetime) });

  const setEndpoint = (which: 'start' | 'end', patch: Partial<Endpoint>) =>
    updateItem(item.key, (it) => {
      const base: Endpoint = it[which] ?? {
        local_datetime: null,
        timezone: it.start.timezone,
        place_name: null,
        code: null,
        city: null,
        country_code: null,
        address: null,
      };
      return { ...it, [which]: { ...base, ...patch } };
    });

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: included ? 1 : 0.55 },
      ]}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: colors.surfaceMuted }]}>
          <Ionicons name={RESERVATION_ICONS[item.type]} size={20} color={colors.primary} />
        </View>
        <Text variant="bodyStrong" style={styles.flex}>
          {t(`reservationType.${item.type}`)}
        </Text>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: included }}
          accessibilityLabel={t('review.include')}
          onPress={() => toggleItem(item.key)}
          style={styles.include}
          hitSlop={8}>
          <Text variant="caption" color="textSecondary">
            {t('review.include')}
          </Text>
          <Ionicons name={included ? 'checkbox' : 'square-outline'} size={22} color={included ? colors.primary : colors.textMuted} />
        </Pressable>
      </View>

      {included && (
        <View style={styles.fields}>
          <TextField
            label={t('review.fieldTitle')}
            value={item.title}
            warning={low('title')}
            onChangeText={(title) => updateItem(item.key, (it) => ({ ...it, title }))}
          />
          <TextField
            label={t('review.fieldReference')}
            value={item.reference_code ?? ''}
            warning={low('reference_code')}
            autoCapitalize="characters"
            onChangeText={(v) => updateItem(item.key, (it) => ({ ...it, reference_code: v.trim() || null }))}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label={t('review.fieldStart')}
                value={dates.start}
                warning={low('start_datetime')}
                error={dateErrors.start ? t('review.invalidDate') : null}
                hint={t('review.dateHint')}
                keyboardType="numbers-and-punctuation"
                onChangeText={(v) => {
                  setDates((d) => ({ ...d, start: v }));
                  onDateText('start', v);
                }}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label={t('review.fieldEnd')}
                value={dates.end}
                warning={low('end_datetime')}
                error={dateErrors.end ? t('review.invalidDate') : null}
                keyboardType="numbers-and-punctuation"
                onChangeText={(v) => {
                  setDates((d) => ({ ...d, end: v }));
                  onDateText('end', v);
                }}
              />
            </View>
          </View>
          {transport ? (
            <View style={styles.row}>
              <View style={styles.flex}>
                <TextField
                  label={t('review.fieldFrom')}
                  value={item.start.city ?? ''}
                  warning={low('start_place')}
                  onChangeText={(city) => setEndpoint('start', { city: city || null })}
                />
              </View>
              <View style={styles.flex}>
                <TextField
                  label={t('review.fieldTo')}
                  value={item.end?.city ?? ''}
                  warning={low('end_place')}
                  onChangeText={(city) => setEndpoint('end', { city: city || null })}
                />
              </View>
            </View>
          ) : (
            <>
              <TextField
                label={t('review.fieldCity')}
                value={item.start.city ?? ''}
                warning={low('start_place')}
                onChangeText={(city) => setEndpoint('start', { city: city || null })}
              />
              <TextField
                label={t('review.fieldAddress')}
                value={item.start.address ?? ''}
                onChangeText={(address) => setEndpoint('start', { address: address || null })}
              />
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** AI'ın okuduğu kalemlerin kontrol edilip onaylandığı ekran. */
export default function TicketReviewScreen() {
  const { t } = useTranslation();
  const { tripId } = useLocalSearchParams<{ tripId?: string }>();
  const { items, excluded, updateItem, reset } = useUploadStore();
  const createTrip = useCreateTripFromDocuments();
  const [dateErrors, setDateErrors] = useState<Record<string, Partial<Record<DateField, boolean>>>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const selected = useMemo(() => items.filter((i) => !excluded.includes(i.key)), [items, excluded]);
  const hasDateErrors = selected.some((i) => dateErrors[i.key]?.start || dateErrors[i.key]?.end);

  const draft = useMemo(() => {
    try {
      return selected.length && !hasDateErrors ? buildTripDraft(selected) : null;
    } catch {
      return null;
    }
  }, [selected, hasDateErrors]);

  function onDateText(item: DraftItem, field: DateField, text: string) {
    const trimmed = text.trim();
    const normalized = normalizeLocalDateTime(trimmed);
    // Bitiş isteğe bağlı: boş bırakılabilir. Başlangıç zorunlu.
    const invalid = field === 'start' ? !normalized : trimmed !== '' && !normalized;
    setDateErrors((e) => ({ ...e, [item.key]: { ...e[item.key], [field]: invalid } }));
    if (invalid) return;
    updateItem(item.key, (it) => {
      if (field === 'start') return { ...it, start: { ...it.start, local_datetime: normalized } };
      if (!normalized) return { ...it, end: it.end ? { ...it.end, local_datetime: null } : null };
      const end: Endpoint = it.end ?? { ...it.start, place_name: null, code: null, address: null };
      return { ...it, end: { ...end, local_datetime: normalized } };
    });
  }

  async function create() {
    setFormError(null);
    if (!selected.length) return setFormError(t('review.nothingSelected'));
    if (hasDateErrors || !draft) return setFormError(t('review.fixDates'));
    try {
      const documentIds = [...new Set(selected.map((i) => i.documentId))];
      const id = await createTrip.mutateAsync({ draft, documentIds, tripId });
      reset();
      if (router.canDismiss()) router.dismissAll();
      router.push({ pathname: '/trip/[id]', params: { id } });
    } catch (e) {
      setFormError(t('review.createFailed', { message: e instanceof Error ? e.message : String(e) }));
    }
  }

  return (
    <Screen
      footer={
        <>
          {formError && (
            <Text variant="caption" color="danger" style={styles.center}>
              {formError}
            </Text>
          )}
          <Button title={t('review.create')} onPress={create} loading={createTrip.isPending} disabled={!selected.length} />
        </>
      }>
      <ModalHeader title={t('review.title')} subtitle={t('review.subtitle')} />
      {draft && (
        <Text variant="bodyStrong" color="textSecondary">
          {t('review.summary', {
            dates: formatDateRange(draft.start_date, draft.end_date),
            cities: draft.destinations.map((d) => d.city).join(', ') || draft.title,
          })}
        </Text>
      )}
      {items.map((item) => (
        <ItemCard
          key={item.key}
          item={item}
          included={!excluded.includes(item.key)}
          dateErrors={dateErrors[item.key] ?? {}}
          onDateText={(field, text) => onDateText(item, field, text)}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.lg, padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  typeIcon: { width: 36, height: 36, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' },
  include: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  fields: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  flex: { flex: 1 },
  center: { textAlign: 'center' },
});
