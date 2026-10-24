import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { DARK_MAP_STYLE } from '@/features/explore/map-style';
import { mapProvider, nativeMapsAvailable, usesGoogleMap } from '@/features/map/availability';
import { isHttpsUrl } from '@/lib/safe-url';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { VEHICLE_ICONS, type RouteChoice } from './api';
import { speakNatural, stopSpeaking } from '@/features/translate/speak';
import { translateLanguage } from '@/features/translate/languages';
import { blendHeading, currentStepIndex, destinationPoint, distanceToPathM, formatDistance, isArrived, isOffRoute, predictPosition, REROUTE_M, remainingMeters, splitAtNearest, turnIcon, zoomForSpeed, type Fix, type TurnIcon } from './navigation-logic';
import { decodePolyline, thin } from './polyline';

const LINE = '#FF5A36';
const PASSED = '#8C97B2';
/** Kamera bu aralıkla (ms) güncellenir; konum 1-2 sn'de bir gelse de harita kesintisiz akar. */
const TICK_MS = 200;
/** Kamera merkezi, konumun bu kadar (m) önüne konur; böylece ok ekranın alt yarısında kalır (Google Haritalar gibi). */
const AHEAD_M = 35;

/** Harita temasına göre panel renkleri (açık haritada koyu yazı, koyu haritada açık yazı). */
const UiColors = createContext<(typeof Colors)[keyof typeof Colors]>(Colors.dark);

function Txt({ color, style, ...rest }: React.ComponentProps<typeof Text>) {
  const ui = useContext(UiColors);
  return <Text {...rest} style={[style, { color: color === 'textSecondary' ? ui.textSecondary : color === 'textMuted' ? ui.textMuted : ui.text }]} />;
}

type MapTheme = 'auto' | 'light' | 'dark';
const TURN_ICON: Record<TurnIcon, 'arrow-up' | 'arrow-back' | 'arrow-forward' | 'refresh'> = { straight: 'arrow-up', left: 'arrow-back', right: 'arrow-forward', uturn: 'refresh' };

type Props = { visible: boolean; route: RouteChoice; googleUrl: string; destinationName: string; onClose: () => void; onReroute?: (from: { lat: number; lng: number }) => void; rerouting?: boolean };

/**
 * Tam ekran gezinme: harita seni yönüne göre takip eder, üstte sıradaki adım, altta kalan mesafe.
 * Başlangıç noktasından uzaksan canlı takip yerine rotanın tamamı önizlenir.
 */
export function NavigationView({ visible, route, googleUrl, destinationName, onClose, onReroute, rerouting = false }: Props) {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const path = useMemo(() => (route.polyline ? thin(decodePolyline(route.polyline)) : []), [route.polyline]);
  const coords = useMemo(() => path.map((p) => ({ latitude: p.lat, longitude: p.lng })), [path]);
  const [here, setHere] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const fix = useRef<Fix | null>(null);
  const [step, setStep] = useState(0);
  const [following, setFollowing] = useState(true);
  const [theme, setTheme] = useState<MapTheme>('auto');
  const [satellite, setSatellite] = useState(false);
  const mapDark = theme === 'auto' ? isDark : theme === 'dark';
  // Üstteki ve alttaki paneller harita temasına uyar (açık haritada koyu yazı, koyu haritada açık yazı).
  const ui = Colors[mapDark ? 'dark' : 'light'];
  // Adım çizgileri: yürüyüş noktalı, toplu taşıma hat renginde, araba düz çizilir.
  const stepPaths = useMemo(() => route.steps.map((st) => st.polylines.map((pl) => thin(decodePolyline(pl)))), [route.steps]);

  useEffect(() => {
    if (!visible) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || !alive) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 }, (p) => {
        const heading = p.coords.heading !== null && p.coords.heading >= 0 ? p.coords.heading : null;
        fix.current = { lat: p.coords.latitude, lng: p.coords.longitude, heading, speed: p.coords.speed !== null && p.coords.speed >= 0 ? p.coords.speed : null, at: Date.now() };
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude, heading });
      });
      if (!alive) sub.remove();
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [visible]);

  const fitted = useRef(false);
  const off = isOffRoute(here, path);
  const live = !off && following;

  // Canlı takip: kamera konum, yön ve hıza göre akar. Her 200 ms'de tahmini konuma kısa bir kayma
  // verilir (konum güncellemeleri arasında da); yön yumuşatılır, hızlandıkça uzaklaşır, ok altta kalır.
  const camera = useRef({ heading: 0, zoom: 18, init: false });
  useEffect(() => {
    if (!visible || !live) return;
    fitted.current = false;
    const id = setInterval(() => {
      const f = fix.current;
      if (!f) return;
      const c = camera.current;
      if (f.heading !== null && (f.speed ?? 0) >= 0.7) c.heading = c.init ? blendHeading(c.heading, f.heading, 0.25) : f.heading;
      c.zoom = c.init ? c.zoom + (zoomForSpeed(f.speed) - c.zoom) * 0.08 : zoomForSpeed(f.speed);
      c.init = true;
      const at = destinationPoint(predictPosition(f, Date.now()), c.heading, AHEAD_M);
      map.current?.animateCamera({ center: { latitude: at.lat, longitude: at.lng }, heading: c.heading, zoom: c.zoom, pitch: 50 }, { duration: TICK_MS + 60 });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [visible, live]);
  // Önizleme: tüm rota görünür.
  useEffect(() => {
    if (!visible || live || !following || fitted.current || coords.length < 2) return;
    fitted.current = true;
    map.current?.fitToCoordinates(coords, { edgePadding: { top: insets.top + 180, right: 48, bottom: 260, left: 48 }, animated: true });
  }, [visible, live, following, coords, insets.top]);

  const remaining = remainingMeters(here, path);
  const arrived = !off && isArrived(remaining);
  const steps = route.steps;
  // Canlı takipte güncel adım konumdan bulunur; önizlemede (ya da konum yokken) ok düğmeleriyle gezilir.
  const auto = Boolean(here) && !off;
  const idx = Math.max(0, Math.min(auto ? currentStepIndex(here, stepPaths.map((parts) => parts.flat()), step) : step, steps.length - 1));
  const current = steps[idx];
  // Çizilecek çizgiler: önceki adımlar ve bu adımın geçilen kısmı gri, kalanı rengiyle.
  const routeLines = useMemo(() => {
    const lines: { key: string; coords: { latitude: number; longitude: number }[]; color: string; width: number; z: number }[] = [];
    const toMap = (pts: { lat: number; lng: number }[]) => pts.map((p) => ({ latitude: p.lat, longitude: p.lng }));
    const add = (key: string, pts: { lat: number; lng: number }[], color: string, z: number) => pts.length > 1 && lines.push({ key, coords: toMap(pts), color, width: 6, z });
    if (!stepPaths.some((parts) => parts.length > 0)) {
      add('all', path, LINE, 2);
      return lines;
    }
    stepPaths.forEach((parts, i) => {
      const color = route.steps[i].transit?.color ?? LINE;
      if (!auto || i > idx) parts.forEach((pts, j) => add(`s${i}-${j}`, pts, color, 2));
      else if (i < idx) parts.forEach((pts, j) => add(`s${i}-${j}`, pts, PASSED, 2));
      else if (here) {
        const { passed, rest } = splitAtNearest(parts, here);
        passed.forEach((pts, j) => add(`p${i}-${j}`, pts, PASSED, 2));
        rest.forEach((pts, j) => add(`r${i}-${j}`, pts, color, 2));
      } else parts.forEach((pts, j) => add(`s${i}-${j}`, pts, color, 2));
    });
    return lines;
  }, [stepPaths, route.steps, path, auto, idx, here]);
  const tr = current?.transit;
  const next = steps[idx + 1];
  const end = coords[coords.length - 1];
  // Bu adımın bitimine (bir sonraki dönüşe) kalan mesafe.
  const stepEnd = stepPaths[idx]?.flat().at(-1);
  const stepLeft = stepEnd ? remainingMeters(here, [stepEnd]) : null;

  const instruction = tr
    ? [tr.lineShort ?? tr.line ?? tr.vehicleName, tr.headsign ? `→ ${tr.headsign}` : null].filter(Boolean).join(' ')
    : current
      ? (current.instruction ?? t('route.walk', { count: current.durationMin }))
      : destinationName;
  // Yürürken/sürerken rotadan 80 m'den fazla ve 8 sn'den uzun süre ayrılırsan rota bulunduğun yerden yeniden hesaplanır
  // (toplu taşıtta çizgiden sapma normal olduğundan yalnızca yürüme/sürüş adımlarında).
  const offSince = useRef<number | null>(null);
  const lastReroute = useRef(0);
  const isTransitStep = Boolean(tr);
  useEffect(() => {
    if (!visible || !here || off || !onReroute || isTransitStep || arrived) {
      offSince.current = null;
      return;
    }
    const d = distanceToPathM(here, path);
    if (d === null || d <= REROUTE_M) {
      offSince.current = null;
      return;
    }
    const now = Date.now();
    offSince.current ??= now;
    if (now - offSince.current >= 8000 && now - lastReroute.current >= 30_000) {
      lastReroute.current = now;
      offSince.current = null;
      onReroute({ lat: here.lat, lng: here.lng });
    }
  }, [visible, here, off, onReroute, isTransitStep, arrived, path]);

  // Sesli yönlendirme: canlı takipte adım değişince talimat okunur.
  const spokenStep = useRef(-1);
  useEffect(() => {
    if (!visible || !live || !auto || !current?.instruction) return;
    if (spokenStep.current === idx) return;
    spokenStep.current = idx;
    // Yola'nın doğal sesiyle (yoksa telefonun sesiyle), uygulama dilinde.
    speakNatural(current.instruction, translateLanguage(i18n.language).speech);
  }, [visible, live, auto, idx, current, i18n.language]);
  useEffect(() => {
    if (!visible) {
      spokenStep.current = -1;
      stopSpeaking();
      return;
    }
    // Gezinirken ekran kararmasın (navigasyon uygulamalarındaki gibi); pencere kapanınca normale döner.
    activateKeepAwakeAsync('yola-navigation').catch(() => undefined);
    return () => {
      deactivateKeepAwake('yola-navigation').catch(() => undefined);
    };
  }, [visible]);

  const detail = tr?.from && tr?.to ? `${tr.from} → ${tr.to}` : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <UiColors.Provider value={ui}>
      <View style={[styles.fill, { backgroundColor: ui.background }]}>
        {nativeMapsAvailable ? (
          <MapView
            provider={mapProvider}
            ref={map}
            style={StyleSheet.absoluteFill}
            initialRegion={coords[0] ? { ...coords[0], latitudeDelta: 0.01, longitudeDelta: 0.01 } : undefined}
            userInterfaceStyle={mapDark ? 'dark' : 'light'}
            mapType={satellite ? 'hybrid' : 'standard'}
            customMapStyle={usesGoogleMap && mapDark && !satellite ? DARK_MAP_STYLE : undefined}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            showsBuildings
            toolbarEnabled={false}
            onPanDrag={() => setFollowing(false)}>
            {/* Yol: koyu kenarlıklı düz çizgi (her haritada okunur). Toplu taşıma hat renginde; geçilen kısım gri. */}
            {routeLines.map((l) => (
              <Fragment key={l.key}>
                <Polyline coordinates={l.coords} strokeColor={mapDark ? 'rgba(5,8,18,0.85)' : 'rgba(255,255,255,0.95)'} strokeWidth={l.width + 4} lineJoin="round" lineCap="round" zIndex={l.z} />
                <Polyline coordinates={l.coords} strokeColor={l.color} strokeWidth={l.width} lineJoin="round" lineCap="round" zIndex={l.z + 1} />
              </Fragment>
            ))}
            {end && <Marker coordinate={end} title={destinationName} />}
          </MapView>
        ) : (
          <View style={styles.center}>
            <Txt variant="body" color="textSecondary">
              {t('route.nav.noMap')}
            </Txt>
          </View>
        )}

        <View style={[styles.top, { top: insets.top + Spacing.sm, backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
          {rerouting && (
            <Txt variant="caption" style={{ color: ui.warning }}>
              {t('route.nav.rerouting')}
            </Txt>
          )}
          {arrived ? (
            <Txt variant="title">{t('route.nav.arrived')}</Txt>
          ) : off ? (
            <View style={styles.row}>
              <Ionicons name="information-circle" size={26} color={ui.warning} />
              <Txt variant="bodyStrong" style={styles.flex}>
                {here && remaining !== null ? t('route.nav.farFromStart', { distance: formatDistance(distanceToStart(here, path)) }) : t('route.nav.locating')}
              </Txt>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Ionicons name={tr ? VEHICLE_ICONS[tr.vehicle] : current && current.mode !== 'transit' && current.maneuver ? TURN_ICON[turnIcon(current.maneuver)] : 'walk'} size={30} color={ui.primary} />
                <View style={styles.flex}>
                  {auto && stepLeft !== null && stepLeft > 15 && (
                    <Txt variant="caption" color="textSecondary">
                      {formatDistance(stepLeft)}
                    </Txt>
                  )}
                  <Txt variant="title" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8}>
                    {instruction}
                  </Txt>
                  {detail && (
                    <Txt variant="caption" color="textSecondary" numberOfLines={1}>
                      {detail}
                    </Txt>
                  )}
                </View>
              </View>
              {steps.length > 1 && !auto && (
                <View style={styles.stepNav}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.prev')} disabled={idx === 0} onPress={() => setStep(Math.max(idx - 1, 0))} hitSlop={10} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-back-circle" size={32} color={ui.textSecondary} />
                  </Pressable>
                  <Txt variant="caption" color="textMuted" style={styles.flex}>
                    {next ? t('route.nav.then', { next: next.transit ? (next.transit.lineShort ?? next.transit.line ?? next.transit.vehicleName ?? '') : t('route.walk', { count: next.durationMin }) }) : t('route.nav.lastStep')}
                  </Txt>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.next')} disabled={idx >= steps.length - 1} onPress={() => setStep(Math.min(idx + 1, steps.length - 1))} hitSlop={10} style={{ opacity: idx >= steps.length - 1 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-forward-circle" size={32} color={ui.primary} />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        <View style={[styles.controls, { top: insets.top + 130 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.theme')} onPress={() => setTheme((v) => (v === 'auto' ? 'light' : v === 'light' ? 'dark' : 'auto'))} style={[styles.control, { backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
            <Ionicons name={theme === 'auto' ? 'contrast' : theme === 'light' ? 'sunny' : 'moon'} size={22} color={ui.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.satellite')} onPress={() => setSatellite((v) => !v)} style={[styles.control, { backgroundColor: satellite ? ui.primary : ui.backgroundElevated, borderColor: ui.border }]}>
            <Ionicons name="earth" size={22} color={satellite ? ui.onPrimary : ui.primary} />
          </Pressable>
        </View>

        {!following && !off && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.recenter')} onPress={() => setFollowing(true)} style={[styles.recenter, { bottom: insets.bottom + 150, backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
            <Ionicons name="locate" size={24} color={ui.primary} />
          </Pressable>
        )}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
          {!off && remaining !== null && (
            <Txt variant="title">{arrived ? t('route.nav.arrivedShort') : t('route.nav.remaining', { distance: formatDistance(remaining) })}</Txt>
          )}
          <View style={styles.row}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[styles.stop, styles.flex, { backgroundColor: arrived ? ui.primary : ui.surfaceMuted }]}>
              <Txt variant="bodyStrong" style={{ color: arrived ? ui.onPrimary : ui.text }}>
                {arrived ? t('route.nav.done') : t('route.nav.stop')}
              </Txt>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.openGoogle')} onPress={() => isHttpsUrl(googleUrl) && Linking.openURL(googleUrl)} hitSlop={8} style={[styles.control, { backgroundColor: ui.surfaceMuted, borderColor: ui.border }]}>
              <Ionicons name="open-outline" size={22} color={ui.textSecondary} />
            </Pressable>
          </View>
        </View>
      </View>
      </UiColors.Provider>
    </Modal>
  );
}

function distanceToStart(here: { lat: number; lng: number }, path: { lat: number; lng: number }[]): number {
  return path[0] ? Math.round(remainingMeters(here, [path[0]]) ?? 0) : 0;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  top: { position: 'absolute', left: Spacing.md, right: Spacing.md, gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  controls: { position: 'absolute', right: Spacing.md, gap: Spacing.sm },
  control: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stop: { height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  recenter: { position: 'absolute', right: Spacing.md, width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.md, padding: Spacing.lg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1 },
});
