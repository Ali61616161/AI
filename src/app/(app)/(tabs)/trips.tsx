import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Segment = 'upcoming' | 'past';

export default function TripsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [segment, setSegment] = useState<Segment>('upcoming');

  return (
    <Screen edges={['top']}>
      <Text variant="display">{t('trips.title')}</Text>

      <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {(['upcoming', 'past'] as const).map((s) => {
          const active = s === segment;
          return (
            <Pressable
              key={s}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setSegment(s)}
              style={[styles.segment, active && { backgroundColor: colors.surface }]}>
              <Text variant="bodyStrong" color={active ? 'text' : 'textSecondary'}>
                {t(`trips.${s}`)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {segment === 'upcoming' ? (
        <EmptyState
          icon="calendar-outline"
          title={t('trips.emptyUpcomingTitle')}
          description={t('trips.emptyUpcomingDescription')}>
          <Button title={t('today.uploadTicket')} onPress={() => router.push('/ticket')} />
        </EmptyState>
      ) : (
        <EmptyState icon="trophy-outline" title={t('trips.emptyPastTitle')} description={t('trips.emptyPastDescription')} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segments: { flexDirection: 'row', padding: Spacing.xs, borderRadius: Radius.pill },
  segment: { flex: 1, alignItems: 'center', paddingVertical: Spacing.sm, borderRadius: Radius.pill },
});
