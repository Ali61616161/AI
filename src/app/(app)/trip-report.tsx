import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useGenerateReport, usePlaceRatings, useRatePlace, useTranslatedReport, useTripReport } from '@/features/report/api';
import { JournalSummary } from '@/features/journal/journal-summary';
import { ShareCard } from '@/features/report/share-card';
import { Stars } from '@/features/report/stars';
import { useActivePlan, useTrip } from '@/features/trips/queries';
import { formatDayShort, formatMoney } from '@/lib/format';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

/** Seyahat sonrası: mekanları puanla, genel puan ver, AI özeti ve paylaşılabilir kart. */
export default function TripReportScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { tripId, overall: overallParam } = useLocalSearchParams<{ tripId: string; overall?: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: plan } = useActivePlan(tripId);
  const { data: rawReport, isLoading } = useTripReport(tripId);
  const report = useTranslatedReport(rawReport);
  const { data: ratings } = usePlaceRatings(tripId);
  const rate = useRatePlace(tripId);
  const generate = useGenerateReport(tripId);
  const [overall, setOverall] = useState<number | null>(() => {
    const n = Number(overallParam);
    return Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  });
  const [route, setRoute] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const cardRef = useRef<View>(null);

  const places = (plan?.day_plans ?? []).flatMap((d) =>
    d.plan_items.filter((i) => !i.is_locked && i.kind !== 'transport' && i.kind !== 'free_time' && i.place_name).map((i) => ({ ...i, date: d.date })),
  );
  const overallValue = overall ?? report?.overall_rating ?? null;
  const routeValue = route ?? report?.route_rating ?? null;
  const feedbackValue = feedback ?? report?.feedback ?? '';

  async function share() {
    if (!cardRef.current) return;
    const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: trip?.title });
  }

  const s = report?.stats;
  const insights = report?.ai_insights;

  return (
    <Screen>
      <ModalHeader title={t('report.title')} subtitle={trip?.title} />

      {isLoading ? (
        <ActivityIndicator />
      ) : (
        report &&
        trip && (
          <>
            <ShareCard ref={cardRef} title={trip.title} start={trip.start_date} end={trip.end_date} report={report} />
            {Platform.OS !== 'web' && <Button title={t('report.share')} variant="secondary" onPress={share} />}
            {insights?.summary ? (
              <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.row}>
                  <Ionicons name="sparkles" size={18} color={colors.primary} />
                  <Text variant="subtitle">{t('report.summary')}</Text>
                </View>
                <Text variant="body">{insights.summary}</Text>
                {(insights.liked.length > 0 || insights.disliked.length > 0) && (
                  <View style={styles.chips}>
                    {insights.liked.map((tag) => (
                      <Chip key={tag} icon="thumbs-up-outline" label={t(`report.tags.${tag}` as 'report.tags.art')} />
                    ))}
                    {insights.disliked.map((tag) => (
                      <Chip key={tag} icon="thumbs-down-outline" label={t(`report.tags.${tag}` as 'report.tags.art')} />
                    ))}
                  </View>
                )}
                {insights.nextTripTip && (
                  <Text variant="caption" color="textSecondary">
                    {t('report.nextTrip')}: {insights.nextTripTip}
                  </Text>
                )}
                <Text variant="caption" color="textMuted">
                  {t('report.personalized')}
                </Text>
              </View>
            ) : null}
            {s && s.spent > 0 && (
              <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text variant="subtitle">{t('report.spending')}</Text>
                {Object.entries(s.spentByCategory).map(([k, v]) => (
                  <View key={k} style={styles.row}>
                    <Text variant="body" style={styles.flex}>
                      {t(`expenses.categories.${k}` as 'expenses.categories.food')}
                    </Text>
                    <Text variant="bodyStrong">{formatMoney(v, s.currency ?? 'EUR')}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        )
      )}

      {trip && <JournalSummary tripId={trip.id} />}

      {places.length > 0 && (
        <View style={styles.section}>
          <Text variant="subtitle">{t('report.ratePlaces')}</Text>
          <Text variant="caption" color="textSecondary">
            {t('report.ratePlacesHint')}
          </Text>
          {places.map((p) => {
            const value = ratings?.get(p.id) ?? null;
            return (
              <View key={p.id} style={[styles.place, { backgroundColor: colors.surface, borderColor: colors.border, opacity: p.status === 'skipped' ? 0.6 : 1 }]}>
                <View style={styles.row}>
                  <Text variant="bodyStrong" style={styles.flex}>
                    {p.place_name}
                  </Text>
                  <Text variant="caption" color="textMuted">
                    {formatDayShort(p.date)}
                  </Text>
                </View>
                <View style={styles.row}>
                  <Stars
                    value={value}
                    size={24}
                    label={t('report.rateLabel', { place: p.place_name })}
                    onChange={(v) => rate.mutate({ itemId: p.id, placeName: p.place_name!, googlePlaceId: p.google_place_id, rating: v })}
                  />
                  <View style={styles.flex} />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: p.status === 'skipped' }}
                    onPress={() => rate.mutate({ itemId: p.id, placeName: p.place_name!, googlePlaceId: p.google_place_id, rating: null })}>
                    <Text variant="caption" color={p.status === 'skipped' ? 'warning' : 'textMuted'}>
                      {p.status === 'skipped' ? t('report.skipped') : t('report.skip')}
                    </Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="subtitle">{t('report.overall')}</Text>
        <Stars value={overallValue} onChange={setOverall} label={t('report.overall')} />
        <Text variant="subtitle">{t('report.routeQuality')}</Text>
        <Stars value={routeValue} onChange={setRoute} label={t('report.routeQuality')} />
        <TextInput
          value={feedbackValue}
          onChangeText={setFeedback}
          multiline
          maxLength={1000}
          placeholder={t('report.feedback')}
          placeholderTextColor={colors.textMuted}
          accessibilityLabel={t('report.feedback')}
          style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        {generate.isError && (
          <Text variant="caption" color="danger">
            {t('common.error')}
          </Text>
        )}
        {generate.data?.ai_failed && (
          <Text variant="caption" color="warning">
            {t('report.aiFailed')}
          </Text>
        )}
        <Button
          title={report ? t('report.update') : t('report.create')}
          loading={generate.isPending}
          onPress={() => generate.mutate({ overallRating: overallValue, routeRating: routeValue, feedback: feedbackValue })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.sm },
  box: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  place: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  input: { minHeight: 80, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, textAlignVertical: 'top' },
});
