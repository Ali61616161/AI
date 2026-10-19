import Ionicons from '@expo/vector-icons/Ionicons';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeIn, useSharedValue, withTiming, ZoomIn } from 'react-native-reanimated';
import { captureRef } from 'react-native-view-shot';
import { scheduleOnRN } from 'react-native-worklets';
import { useTranslation } from 'react-i18next';

import { LogoMark } from '@/components/brand/logo-mark';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { RewardedButton } from '@/features/ads/rewarded-button';
import { nextWeekendDates } from '@/features/city/dates';
import { AccessBadge } from '@/features/identity/access-badge';
import { Wheel } from '@/features/spin/wheel';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { flag } from '@/features/tools/emergency-numbers';
import { localCountryName } from '@/features/tools/countries';
import { haptic } from '@/lib/haptics';
import { getSupabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { bestAccess } from '../../../supabase/functions/_shared/visa-access.ts';
import { drawWheel, landingAngle, spinPool, type CostLevel, type Destination, type Region, type VisaFilter, type Vibe } from '../../../supabase/functions/_shared/destinations.ts';

const REGIONS: Region[] = ['europe', 'middle_east', 'asia', 'africa', 'americas', 'oceania'];
const VIBES: Vibe[] = ['beach', 'city', 'culture', 'food', 'nature', 'adventure'];
const COST_LABEL: Record<CostLevel, string> = { 1: '< $50', 2: '$50–100', 3: '$100–180', 4: '$180+' };
type When = 'this' | 'next' | 'any';

/** Ay aralıklarını kısa adlarla yazar: [11,12,1,2,3] → "Kas–Mar". */
function monthRanges(months: number[], locale: string) {
  const name = (m: number) => new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, m - 1, 1)));
  const set = new Set(months);
  const starts = months.filter((m) => !set.has(m === 1 ? 12 : m - 1));
  if (!starts.length) return name(1) + '–' + name(12);
  return starts
    .map((s) => {
      let e = s;
      while (set.has(e === 12 ? 1 : e + 1) && (e === 12 ? 1 : e + 1) !== s) e = e === 12 ? 1 : e + 1;
      return e === s ? name(s) : `${name(s)}–${name(e)}`;
    })
    .join(', ');
}

/** Paylaşılabilir hikâye kartı (sonucun kendisi; görsel olarak kaydedilir). */
function ResultCard({ d, passports, extras, cardRef }: { d: Destination; passports: string[]; extras: string[]; cardRef: React.RefObject<View | null> }) {
  const { t, i18n } = useTranslation();
  const access = passports.length ? bestAccess(passports, extras, d.code) : null;
  return (
    <View ref={cardRef} collapsable={false}>
      <LinearGradient colors={['#1D2B64', '#7C5CFF', '#FF3D7F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        <View pointerEvents="none" style={styles.cardRing} />
        <Text variant="overline" style={styles.whiteSoft}>
          {t('spin.sentMe')}
        </Text>
        <Text style={styles.bigFlag}>{flag(d.code)}</Text>
        <Text variant="hero" style={styles.white} numberOfLines={2}>
          {localCountryName(d.code, i18n.language)}
        </Text>
        <Text variant="subtitle" style={styles.whiteSoft}>
          {d.city}
        </Text>
        <View style={styles.facts}>
          {access && (
            <View style={styles.fact}>
              <Ionicons name="id-card" size={14} color="#FFFFFF" />
              <Text variant="caption" style={styles.white}>
                {t(`access.${access.status}`)}
                {access.days ? ` · ${t('access.days', { count: access.days })}` : ''}
              </Text>
            </View>
          )}
          <View style={styles.fact}>
            <Ionicons name="sunny" size={14} color="#FFFFFF" />
            <Text variant="caption" style={styles.white}>
              {t('spin.bestTime', { months: monthRanges(d.months, i18n.language) })}
            </Text>
          </View>
          <View style={styles.fact}>
            <Ionicons name="wallet" size={14} color="#FFFFFF" />
            <Text variant="caption" style={styles.white}>
              {t('spin.daily', { range: COST_LABEL[d.cost] })}
            </Text>
          </View>
        </View>
        <View style={styles.cardFoot}>
          <LogoMark size={28} withBackground={false} />
          <Text variant="caption" style={styles.whiteSoft}>
            {t('spin.footer')}
          </Text>
        </View>
      </LinearGradient>
    </View>
  );
}

/** Çark: bütçe, mevsim ve pasaporta uyan ülkeler arasından rastgele seçim. */
export default function SpinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const identity = useSessionStore((s) => s.identity);
  const passports = useMemo(() => [identity.passport, ...identity.otherPassports].filter((p): p is string => !!p), [identity.passport, identity.otherPassports]);

  const [maxCost, setMaxCost] = useState<CostLevel>(2);
  const [when, setWhen] = useState<When>('this');
  const [visa, setVisa] = useState<VisaFilter>(passports.length ? 'easy' : 'any');
  const [region, setRegion] = useState<Region | null>(null);
  const [vibe, setVibe] = useState<Vibe | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'spinning' | 'result' | 'limit'>('idle');
  const [slots, setSlots] = useState<Destination[]>([]);
  const [winner, setWinner] = useState<Destination | null>(null);
  const rotation = useSharedValue(0);
  const cardRef = useRef<View>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const month = when === 'any' ? null : ((new Date().getMonth() + (when === 'next' ? 1 : 0)) % 12) + 1;
  const pool = useMemo(() => spinPool({ passports, extras: identity.extraVisas, month, maxCost, visa, region, vibe }), [passports, identity.extraVisas, month, maxCost, visa, region, vibe]);
  // Dönmeden önce çarkta havuzdan örnek bayraklar görünür.
  const preview = useMemo(() => pool.slice(0, 8), [pool]);
  const shown = slots.length ? slots : preview;
  const size = Math.min(width - Spacing.xl * 2, 340);

  async function allowed(): Promise<boolean> {
    const { data, error } = await getSupabase().rpc('consume_quota', { p_feature: 'spin' }).single<{ allowed: boolean }>();
    return !error && !!data?.allowed;
  }

  function reveal(d: Destination) {
    setWinner(d);
    setPhase('result');
    haptic.success();
  }

  async function spin() {
    const draw = drawWheel(pool);
    if (!draw) return;
    setPhase('spinning');
    if (!(await allowed())) {
      setPhase('limit');
      haptic.warning();
      return;
    }
    setWinner(null);
    setSlots(draw.slots);
    haptic.press();
    const target = landingAngle(rotation.get(), draw.winner, draw.slots.length);
    const chosen = draw.slots[draw.winner];
    rotation.set(
      withTiming(target, { duration: 4200, easing: Easing.out(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(reveal, chosen);
      }),
    );
    // Dönerken yavaşlayan tık titreşimleri.
    timers.current.forEach(clearTimeout);
    timers.current = [];
    let delay = 0;
    for (let i = 0; i < 16; i++) {
      delay += 60 + i * i * 4;
      timers.current.push(setTimeout(() => haptic.select(), delay));
    }
  }

  async function share() {
    if (!cardRef.current) return;
    const uri = await captureRef(cardRef, { format: 'png', quality: 1, result: 'tmpfile' });
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('spin.title') });
  }

  function planIt(d: Destination) {
    const { start, end } = nextWeekendDates(3);
    router.push({ pathname: '/trip-new', params: { city: d.city, country: d.code, start, end } });
  }

  return (
    <Screen
      footer={
        phase === 'result' && winner ? (
          <Animated.View entering={FadeIn} style={styles.footer}>
            <Button title={t('spin.planIt')} icon="sparkles" onPress={() => planIt(winner)} />
            <View style={styles.row}>
              {Platform.OS !== 'web' && <Button title={t('spin.share')} icon="share-social" variant="secondary" style={styles.flex} onPress={share} />}
              <Button title={t('spin.again')} icon="refresh" variant="ghost" style={styles.flex} onPress={spin} />
            </View>
          </Animated.View>
        ) : (
          <Button title={t('spin.spin')} icon="aperture" disabled={!pool.length || phase === 'spinning'} loading={phase === 'spinning'} onPress={spin} />
        )
      }>
      <ModalHeader title={t('spin.title')} subtitle={t('spin.subtitle', { count: pool.length })} />

      {phase === 'result' && winner ? (
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.gap}>
          <ResultCard d={winner} passports={passports} extras={identity.extraVisas} cardRef={cardRef} />
          {passports.length > 0 && <AccessBadge passports={passports} extras={identity.extraVisas} destination={winner.code} />}
        </Animated.View>
      ) : (
        <View style={styles.wheelWrap}>
          <Wheel size={size} labels={shown.map((d) => flag(d.code))} rotation={rotation} />
        </View>
      )}

      {phase === 'limit' && (
        <Card>
          <View style={styles.gap}>
            <Text variant="bodyStrong" color="warning">
              {t('spin.limit')}
            </Text>
            <View style={styles.row}>
              <UpgradeButton />
              <RewardedButton feature="spin" onRewarded={() => setPhase('idle')} />
            </View>
          </View>
        </Card>
      )}

      {!pool.length && (
        <Text variant="body" color="warning">
          {t('spin.empty')}
        </Text>
      )}
      {!passports.length && (
        <Tap accessibilityRole="button" onPress={() => router.push('/passport')} feedback="select">
          <Text variant="caption" color="primary">
            {t('spin.addPassport')}
          </Text>
        </Tap>
      )}

      {phase !== 'result' && phase !== 'spinning' && (
        <>
          <Tap accessibilityRole="button" onPress={() => setShowFilters((v) => !v)} feedback="select">
            <View style={[styles.filterHead, { borderColor: colors.border, backgroundColor: colors.surface }]}>
              <Ionicons name="options" size={18} color={colors.primary} />
              <Text variant="bodyStrong" style={styles.flex}>
                {t('spin.filters')}
              </Text>
              <Ionicons name={showFilters ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
          </Tap>
          {showFilters && (
            <Animated.View entering={FadeIn} style={styles.gap}>
              <Text variant="overline" color="textMuted">
                {t('spin.budget')}
              </Text>
              <View style={styles.chips}>
                {([1, 2, 3, 4] as CostLevel[]).map((c) => (
                  <Chip key={c} label={t(`spin.cost.${c}`)} selected={maxCost === c} onPress={() => setMaxCost(c)} />
                ))}
              </View>
              <Text variant="overline" color="textMuted">
                {t('spin.when')}
              </Text>
              <View style={styles.chips}>
                {(['this', 'next', 'any'] as When[]).map((w) => (
                  <Chip key={w} label={t(`spin.whenOptions.${w}`)} selected={when === w} onPress={() => setWhen(w)} />
                ))}
              </View>
              {passports.length > 0 && (
                <>
                  <Text variant="overline" color="textMuted">
                    {t('spin.visa')}
                  </Text>
                  <View style={styles.chips}>
                    {(['easy', 'evisa', 'any'] as VisaFilter[]).map((v) => (
                      <Chip key={v} label={t(`spin.visaOptions.${v}`)} selected={visa === v} onPress={() => setVisa(v)} />
                    ))}
                  </View>
                </>
              )}
              <Text variant="overline" color="textMuted">
                {t('spin.region')}
              </Text>
              <View style={styles.chips}>
                <Chip label={t('spin.anywhere')} selected={region === null} onPress={() => setRegion(null)} />
                {REGIONS.map((r) => (
                  <Chip key={r} label={t(`spin.regions.${r}`)} selected={region === r} onPress={() => setRegion(r)} />
                ))}
              </View>
              <Text variant="overline" color="textMuted">
                {t('spin.vibe')}
              </Text>
              <View style={styles.chips}>
                <Chip label={t('spin.anything')} selected={vibe === null} onPress={() => setVibe(null)} />
                {VIBES.map((v) => (
                  <Chip key={v} label={t(`spin.vibes.${v}`)} selected={vibe === v} onPress={() => setVibe(v)} />
                ))}
              </View>
            </Animated.View>
          )}
          <Text variant="caption" color="textMuted">
            {t('spin.note')}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap: { gap: Spacing.sm },
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  footer: { gap: Spacing.sm },
  wheelWrap: { alignItems: 'center', paddingVertical: Spacing.md },
  filterHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  card: { borderRadius: Radius.xl, padding: Spacing.xl, gap: Spacing.sm, overflow: 'hidden', minHeight: 420, justifyContent: 'center' },
  cardRing: { position: 'absolute', right: -80, top: -80, width: 260, height: 260, borderRadius: 130, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  bigFlag: { fontSize: 84, lineHeight: 100 },
  white: { color: '#FFFFFF' },
  whiteSoft: { color: 'rgba(255,255,255,0.85)' },
  facts: { gap: Spacing.xs, marginTop: Spacing.md },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.22)' },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.lg },
});
