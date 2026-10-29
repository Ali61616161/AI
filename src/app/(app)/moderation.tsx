import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useIsModerator, useModerationQueue, useResolveReport, type ModerationReport } from '@/features/social/api';
import { formatLocalDateTime } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Action = 'dismissed' | 'warned' | 'suspended' | 'banned';

function ReportCard({ report }: { report: ModerationReport }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const resolve = useResolveReport();
  const done = report.status === 'resolved';
  const name = (n: string | null) => n ?? t('social.traveler');
  const act = (action: Action) => resolve.mutate({ id: report.id, action });

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: done ? colors.border : colors.primary }]}>
      <View style={styles.chips}>
        <Chip label={t(`social.reasons.${report.reason}`)} />
        {report.reported_suspended && <Chip icon="pause-circle-outline" label={t('moderation.suspended')} />}
        {done && report.resolution && <Chip icon="checkmark" label={t(`moderation.resolution.${report.resolution}`)} />}
      </View>
      <Text variant="bodyStrong">
        {name(report.reporter_name)} → {name(report.reported_name)}
      </Text>
      <Text variant="caption" color="textSecondary">
        {formatLocalDateTime(report.created_at, null)} · {t('moderation.counts', { onReported: report.reports_on_reported, byReporter: report.reports_by_reporter })}
      </Text>
      {report.details ? <Text variant="body">“{report.details}”</Text> : null}

      {report.evidence ? (
        <View style={styles.evidence}>
          <Text variant="caption" color="textMuted">
            {t('moderation.evidence', { place: report.evidence.place })}
          </Text>
          {report.evidence.invite_message ? (
            <Text variant="caption" color="textSecondary">
              {t('moderation.inviteNote', { who: report.evidence.invited_by === 'reported' ? name(report.reported_name) : name(report.reporter_name) })}: {report.evidence.invite_message}
            </Text>
          ) : null}
          {report.evidence.messages.map((m) => {
            const reportedSide = m.from === 'reported';
            return (
              <View
                key={m.id}
                style={[
                  styles.bubble,
                  reportedSide ? styles.left : styles.right,
                  { backgroundColor: m.id === report.message_id ? colors.surfaceMuted : colors.background, borderColor: m.id === report.message_id ? colors.primary : colors.border },
                ]}>
                <Text variant="caption" color="textMuted">
                  {reportedSide ? name(report.reported_name) : name(report.reporter_name)} · {formatLocalDateTime(m.at, null)}
                  {m.deleted ? ` · ${t('moderation.deleted')}` : ''}
                </Text>
                <Text variant="body">{m.body}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text variant="caption" color="textMuted">
          {t('moderation.noEvidence')}
        </Text>
      )}

      {!done && (
        <View style={styles.chips}>
          <Button title={t('moderation.actions.dismissed')} variant="ghost" loading={resolve.isPending && resolve.variables?.id === report.id} onPress={() => act('dismissed')} />
          <Button title={t('moderation.actions.warned')} variant="secondary" onPress={() => act('warned')} />
          <Button title={t('moderation.actions.suspended')} variant="secondary" onPress={() => act('suspended')} />
          <Button title={t('moderation.actions.banned')} onPress={() => act('banned')} />
        </View>
      )}
    </View>
  );
}

/** Yalnızca yönetici hesabında: kullanıcı şikayetleri, sohbet delili ve karar (reddet/uyar/askıya al/yasakla). */
export default function ModerationScreen() {
  const { t } = useTranslation();
  const { data: isModerator, isLoading: checking } = useIsModerator();
  const { data, isLoading, refetch } = useModerationQueue();

  return (
    <Screen>
      <ModalHeader title={t('moderation.title')} subtitle={t('moderation.subtitle')} />
      {checking || isLoading ? (
        <ActivityIndicator />
      ) : !isModerator ? (
        <EmptyState icon="lock-closed-outline" title={t('moderation.title')} description={t('moderation.notAllowed')} />
      ) : !data?.length ? (
        <EmptyState icon="shield-checkmark-outline" title={t('moderation.title')} description={t('moderation.empty')}>
          <Button title={t('common.retry')} variant="secondary" onPress={() => refetch()} />
        </EmptyState>
      ) : (
        data.map((r) => <ReportCard key={r.id} report={r} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  evidence: { gap: Spacing.xs },
  bubble: { maxWidth: '90%', gap: 2, padding: Spacing.sm, borderRadius: Radius.md, borderWidth: 1 },
  left: { alignSelf: 'flex-start' },
  right: { alignSelf: 'flex-end' },
});
