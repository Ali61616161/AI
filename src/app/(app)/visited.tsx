import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { Text } from '@/components/ui/text';
import { addCountriesFromTrips, pushVisited, useVisitedCities, useVisitedPercentile } from '@/features/travel/api';
import { VisitedCard } from '@/features/travel/visited-card';
import { VisitedPicker } from '@/features/travel/visited-picker';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { summarizeVisited } from '../../../supabase/functions/_shared/continents.ts';
import { ALL_DESTINATIONS, bestAccess, isEasy } from '../../../supabase/functions/_shared/visa-access.ts';

const BADGES = [
  { key: 'c5', icon: 'flag', reached: (n: number) => n >= 5 },
  { key: 'c10', icon: 'airplane', reached: (n: number) => n >= 10 },
  { key: 'c25', icon: 'globe', reached: (n: number) => n >= 25 },
  { key: 'c50', icon: 'trophy', reached: (n: number) => n >= 50 },
] as const;
const CONTINENT_BADGES = [
  { key: 'k3', icon: 'earth', reached: (n: number) => n >= 3 },
  { key: 'k6', icon: 'planet', reached: (n: number) => n >= 6 },
] as const;

/** Gezdiğim ülkeler: dünya ve kıta yüzdeleri, şehirler, rozetler ve paylaşım kartı. */
export default function VisitedScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const visited = useSessionStore((s) => s.visitedCountries);
  const setVisited = useSessionStore((s) => s.setVisitedCountries);
  const identity = useSessionStore((s) => s.identity);
  const { data: cities } = useVisitedCities();
  const { data: percentile } = useVisitedPercentile();
  const summary = useMemo(() => summarizeVisited(visited), [visited]);
  const cardRef = useRef<View>(null);
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Biten Yola seyahatlerinin ülkeleri otomatik eklenir.
  useEffect(() => {
    addCountriesFromTrips().catch(() => undefined);
  }, []);

  const passports = useMemo(() => [identity.passport, ...identity.otherPassports].filter((p): p is string => !!p), [identity.passport, identity.otherPassports]);
  const easy = useMemo(() => {
    if (!passports.length) return null;
    const list = ALL_DESTINATIONS.filter((d) => !passports.includes(d) && isEasy(bestAccess(passports, identity.extraVisas, d)?.status ?? 'visa_required'));
    return { total: list.length, visited: list.filter((d) => visited.includes(d)).length };
  }, [passports, identity.extraVisas, visited]);

  function change(codes: string[]) {
    setVisited(codes);
    // Art arda dokunuşlar tek istekte hesaba yazılır.
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => pushVisited(useSessionStore.getState().visitedCountries).catch(() => undefined), 1200);
  }

  async function share() {
    const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('visited.title') });
  }

  return (
    <Screen>
      <ModalHeader title={t('visited.title')} subtitle={t('visited.subtitle')} />
      <VisitedCard summary={summary} cities={cities ?? null} cardRef={cardRef} />
      {Platform.OS !== 'web' && summary.countries > 0 && <Button title={t('visited.share')} icon="share-social" variant="secondary" onPress={share} />}

      {easy && easy.total > 0 && (
        <Card>
          <View style={styles.row}>
            <Ionicons name="id-card" size={20} color={colors.accent} />
            <Text variant="body" style={styles.flex}>
              {t('visited.easyLine', { visited: easy.visited, total: easy.total })}
            </Text>
          </View>
        </Card>
      )}
      {percentile !== null && percentile !== undefined && (
        <Card>
          <View style={styles.row}>
            <Ionicons name="podium" size={20} color={colors.warning} />
            <Text variant="body" style={styles.flex}>
              {t('visited.percentile', { percent: percentile })}
            </Text>
          </View>
        </Card>
      )}

      <View style={styles.section}>
        <SectionHeader title={t('visited.badgesTitle')} />
        <View style={styles.badges}>
          {[...BADGES.map((b) => ({ ...b, on: b.reached(summary.countries) })), ...CONTINENT_BADGES.map((b) => ({ ...b, on: b.reached(summary.continents) }))].map((b) => (
            <View key={b.key} style={[styles.badge, { backgroundColor: colors.surface, borderColor: b.on ? colors.primary : colors.border, opacity: b.on ? 1 : 0.5 }]}>
              {b.on ? (
                <LinearGradient colors={Gradients.primary} style={styles.badgeIcon}>
                  <Ionicons name={b.icon} size={20} color="#FFFFFF" />
                </LinearGradient>
              ) : (
                <View style={[styles.badgeIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name="lock-closed" size={16} color={colors.textMuted} />
                </View>
              )}
              <Text variant="caption" style={styles.center} numberOfLines={2}>
                {t(`visited.badges.${b.key}`)}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('visited.pickTitle')} />
        <Text variant="caption" color="textSecondary">
          {t('visited.pickHint')}
        </Text>
        <VisitedPicker value={visited} onChange={change} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  section: { gap: Spacing.md },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  badge: { width: '30%', flexGrow: 1, alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  badgeIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
});
