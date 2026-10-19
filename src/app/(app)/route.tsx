import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SkeletonCard } from '@/components/ui/skeleton';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { openBookingLink, PlacesError } from '@/features/places/api';
import { getCurrentLocation } from '@/features/plan/replan';
import { NavigationView } from '@/features/transport/navigation-view';
import { defaultFromChoice, type FromChoice } from '@/features/transport/navigation-logic';
import { isFar, pickTripOrigin } from '@/features/transport/route-origin';
import { useTrip } from '@/features/trips/queries';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { useRoute, VEHICLE_ICONS, type RouteChoice, type RouteMode, type RoutePoint, type RouteStepWithTickets } from '@/features/transport/api';
import { RouteMap } from '@/features/transport/route-map';
import { TicketLinks } from '@/features/transport/ticket-links';
import { formatMoney } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const MODES: { key: RouteMode; icon: 'train' | 'car' | 'walk' }[] = [
  { key: 'transit', icon: 'train' },
  { key: 'drive', icon: 'car' },
  { key: 'walk', icon: 'walk' },
];

type Params = {
  toLat?: string;
  toLng?: string;
  toName?: string;
  toAddress?: string;
  fromLat?: string;
  fromLng?: string;
  fromName?: string;
  fromAddress?: string;
  country?: string;
  departAt?: string;
  /** Seyahat: kullanıcı hedeften çok uzaktaysa rota otelden/varış noktasından başlatılır. */
  tripId?: string;
};

function point(lat?: string, lng?: string, address?: string): RoutePoint | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (lat && lng && Number.isFinite(la) && Number.isFinite(ln)) return { lat: la, lng: ln };
  return address ? { address } : null;
}

/** "Nasıl giderim?": tren, metro, tramvay, otobüs, feribot, teleferik; araba ve yürüyüş. */
export default function RouteScreen() {
  const { t } = useTranslation();
  const p = useLocalSearchParams<Params>();
  const destination = point(p.toLat, p.toLng, p.toAddress ?? p.toName);
  const given = point(p.fromLat, p.fromLng, p.fromAddress);
  const [here, setHere] = useState<RoutePoint | null | 'denied'>(null);
  const [modeChoice, setModeChoice] = useState<RouteMode | null>(null);
  const [selected, setSelected] = useState(0);
  const [fromChoice, setFromChoice] = useState<FromChoice | null>(null);
  const [navigating, setNavigating] = useState(false);

  // Kullanıcının konumu her zaman alınır: başlangıç verilmediyse başlangıçtır, verildiyse
  // (plan durağı) "Konumum / Önceki durak" seçiminin varsayılanını belirler.
  useEffect(() => {
    let alive = true;
    getCurrentLocation().then((c) => alive && setHere(c ?? 'denied'));
    return () => {
      alive = false;
    };
  }, []);

  // Hedef bulunduğun yerden çok uzaksa (uçuş gerekir) "Konumum"dan rota anlamsız olur; seyahatte
  // otel ya da varış havalimanı biliniyorsa rota oradan başlar.
  const { data: trip } = useTrip(p.tripId);
  // Seyahatte araba seçildiyse rota araba, aksi halde toplu taşıma ile açılır; kullanıcı değiştirebilir.
  const mode: RouteMode = modeChoice ?? (trip?.local_transport === 'car' ? 'drive' : 'transit');
  const dest = destination && 'lat' in destination ? destination : null;
  const hereCoords = here && here !== 'denied' && 'lat' in here ? here : null;
  const choice: FromChoice = given ? (fromChoice ?? defaultFromChoice(hereCoords, dest, true)) : 'here';
  const usePrev = given !== null && choice === 'prev';
  const far = !usePrev && hereCoords !== null && dest !== null && isFar(hereCoords, dest);
  const tripOrigin = far && trip ? pickTripOrigin(trip.reservations) : null;
  const origin: RoutePoint | null = usePrev ? given : tripOrigin ? { address: tripOrigin.address } : hereCoords;
  const query = useRoute({
    origin,
    destination,
    mode,
    originName: usePrev ? (p.fromName ?? null) : (tripOrigin?.name ?? null),
    destinationName: p.toName ?? p.toAddress ?? null,
    countryCode: p.country ?? null,
    departAt: p.departAt ?? null,
  });
  const data = query.data;

  return (
    <Screen>
      <ModalHeader title={t('route.title')} subtitle={`${usePrev ? (p.fromName ?? t('route.prevStop')) : (tripOrigin?.name ?? t('route.myLocation'))} → ${p.toName ?? p.toAddress ?? ''}`} />

      {given && (
        <View style={styles.modes}>
          <Chip icon="locate" label={t('route.myLocation')} selected={choice === 'here'} onPress={() => setFromChoice('here')} />
          <Chip icon="flag" label={p.fromName ? t('route.fromPrev', { name: p.fromName }) : t('route.prevStop')} selected={choice === 'prev'} onPress={() => setFromChoice('prev')} />
        </View>
      )}

      {tripOrigin && (
        <Card variant="solid" padding={Spacing.md}>
          <Text variant="caption" color="textSecondary">
            {t('route.farStart', { from: tripOrigin.name })}
          </Text>
        </Card>
      )}

      <View style={styles.modes}>
        {MODES.map((m) => (
          <Chip key={m.key} icon={m.icon} label={t(`route.mode.${m.key}`)} selected={mode === m.key} onPress={() => {
              setModeChoice(m.key);
              setSelected(0);
            }} />
        ))}
      </View>

      {!usePrev && here === 'denied' && (
        <Card>
          <Text variant="body">{t('route.needLocation')}</Text>
        </Card>
      )}

      {data && data.routes.length > 0 && (
        <NavigationView
          visible={navigating}
          route={data.routes[Math.min(selected, data.routes.length - 1)]}
          googleUrl={data.navigation_url}
          destinationName={p.toName ?? p.toAddress ?? ''}
          onClose={() => setNavigating(false)}
        />
      )}

      {query.isLoading && (
        <>
          <SkeletonCard lines={3} />
          <SkeletonCard lines={3} />
        </>
      )}

      {query.error && <RouteErrorNote error={query.error} />}

      {data && (
        <>
          {data.routes.length === 0 ? (
            <Card>
              <Text variant="bodyStrong">{mode === 'transit' ? t('route.noTransit') : t('route.noRoute')}</Text>
              <Text variant="body" color="textSecondary">
                {t('route.noTransitHint')}
              </Text>
            </Card>
          ) : (
            <>
              <RouteMap polyline={data.routes[Math.min(selected, data.routes.length - 1)]?.polyline ?? null} />
              {data.routes.map((r, i) => (
                <RouteCard key={i} mode={mode} route={r} best={i === Math.min(selected, data.routes.length - 1)} onPress={() => setSelected(i)} />
              ))}
            </>
          )}

          {data.tickets.length > 0 && (
            <View style={styles.section}>
              <SectionHeader title={t('route.ticketsTitle')} />
              <Card>
                <Text variant="body" color="textSecondary">
                  {t('route.ticketsHint')}
                </Text>
                <TicketLinks options={data.tickets} showModes />
              </Card>
            </View>
          )}

          {data.routes.length > 0 && (
            <Button title={t('route.startNavigation')} icon="navigate" onPress={() => setNavigating(true)} />
          )}
          <Button title={t('route.nav.openGoogle')} variant="ghost" icon="open-outline" onPress={() => Linking.openURL(data.navigation_url)} />
        </>
      )}
    </Screen>
  );
}

function RouteCard({ route, best, mode, onPress }: { route: RouteChoice; best: boolean; mode: RouteMode; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const transfers = Math.max(route.steps.filter((s) => s.transit).length - 1, 0);
  return (
    <Card variant={best ? 'glow' : 'glass'} onPress={onPress} accessibilityLabel={route.durationText ?? undefined}>
      <View style={styles.summary}>
        <View style={styles.flex}>
          <Text variant="subtitle">{route.durationText ?? t('route.minutes', { count: route.durationMin })}</Text>
          <Text variant="caption" color="textSecondary">
            {[
              route.departAt && route.arriveAt ? `${route.departAt} → ${route.arriveAt}` : null,
              route.distanceText,
              route.steps.some((s) => s.transit) ? (transfers ? t('route.transfers', { count: transfers }) : t('route.direct')) : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        {(route.fareText || route.fare) && (
          <View style={[styles.fare, { backgroundColor: colors.surfaceMuted }]}>
            <Text variant="caption">{route.fareText ?? formatMoney(route.fare!.amount, route.fare!.currency)}</Text>
          </View>
        )}
      </View>
      {mode === 'transit' && route.steps.map((s, i) => <StepRow key={i} step={s} />)}
    </Card>
  );
}

function StepRow({ step }: { step: RouteStepWithTickets }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tr = step.transit;
  if (!tr) {
    return (
      <View style={styles.step}>
        <Ionicons name="walk" size={18} color={colors.textSecondary} />
        <Text variant="caption" color="textSecondary" style={styles.flex}>
          {t('route.walk', { count: step.durationMin })}
        </Text>
      </View>
    );
  }
  const lineLabel = tr.lineShort ?? tr.line ?? tr.vehicleName ?? t(`route.vehicle.${tr.vehicle}`);
  return (
    <View style={styles.step}>
      <Ionicons name={VEHICLE_ICONS[tr.vehicle]} size={18} color={colors.primary} />
      <View style={styles.flex}>
        <View style={styles.lineRow}>
          <View style={[styles.pill, { backgroundColor: tr.color ?? colors.primary }]}>
            <Text variant="caption" style={{ color: tr.textColor ?? '#FFFFFF' }} numberOfLines={1}>
              {lineLabel}
            </Text>
          </View>
          {tr.headsign && (
            <Text variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
              → {tr.headsign}
            </Text>
          )}
        </View>
        <Text variant="bodyStrong" numberOfLines={2}>
          {[tr.departAt, tr.from].filter(Boolean).join(' ')} → {[tr.arriveAt, tr.to].filter(Boolean).join(' ')}
        </Text>
        <Text variant="caption" color="textMuted">
          {[t(`route.vehicle.${tr.vehicle}`), tr.stops !== null ? t('route.stops', { count: tr.stops }) : null, t('route.minutes', { count: step.durationMin })]
            .filter(Boolean)
            .join(' · ')}
        </Text>
        {tr.agency && (
          <Tap
            accessibilityRole="link"
            disabled={!tr.agencyUrl}
            onPress={() => tr.agencyUrl && openBookingLink(tr.agencyUrl)}
            feedback="select"
            style={styles.agency}
          >
            <Ionicons name="business-outline" size={14} color={tr.agencyUrl ? colors.primary : colors.textMuted} />
            <Text variant="caption" color={tr.agencyUrl ? 'primary' : 'textMuted'} numberOfLines={1}>
              {tr.agencyUrl ? t('route.officialSite', { agency: tr.agency }) : tr.agency}
            </Text>
          </Tap>
        )}
        <TicketLinks options={step.tickets} />
      </View>
    </View>
  );
}

function RouteErrorNote({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const code = error instanceof PlacesError ? error.code : 'network';
  return (
    <Card>
      <Text variant="bodyStrong" color={code === 'quota_exceeded' ? 'warning' : 'danger'}>
        {t(`route.errors.${code}`)}
      </Text>
      {code === 'quota_exceeded' && <UpgradeButton />}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  section: { gap: Spacing.md },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  fare: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: Radius.sm },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, paddingTop: Spacing.sm },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, maxWidth: 180 },
  agency: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
});
