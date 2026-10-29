import Ionicons from '@expo/vector-icons/Ionicons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { FlatList, Linking, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { DARK_MAP_STYLE } from '@/features/explore/map-style';
import { mapProvider, nativeMapsAvailable, usesGoogleMap } from '@/features/map/availability';
import { isHttpsUrl } from '@/lib/safe-url';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { VEHICLE_ICONS, type RouteChoice, type RouteStepWithTickets } from './api';
import { speakNatural, stopSpeaking } from '@/features/translate/speak';
import { translateLanguage } from '@/features/translate/languages';
import { blendHeading, currentStepIndex, destinationPoint, distanceToPathM, formatDistance, isArrived, isOffRoute, predictPosition, REROUTE_M, remainingAlongPath, remainingMeters, splitAtNearest, turnIcon, zoomForSpeed, type Fix, type TurnIcon } from './navigation-logic';
import { decodePolyline, thin } from './polyline';

const LINE = '#FF5A36';
const PASSED = '#8C97B2';
/**
 * Kamera bu aralıkla (ms) güncellenir ve her güncelleme aynı sürede kayar (konum 1-2 sn'de bir gelse de harita akıcı).
 * Daha sık (200 ms) güncelleme, animasyonları üst üste bindirip haritayı kastırıyordu.
 */
const TICK_MS = 500;
/** Kamera bu kadar (m / derece / yakınlaştırma) değişmediyse güncelleme atlanır. */
const CAM_MIN_MOVE_M = 0.8;
const CAM_MIN_HEADING = 1.5;
const CAM_MIN_ZOOM = 0.03;
/** Ekran durumu (yazılar, adım) en çok bu aralıkta (ms) yenilenir; kamera ve çizgi konumu ayrı çalışır. */
const UI_REFRESH_MS = 800;
/** Kamera merkezi, konumun bu kadar (m) önüne konur; böylece ok ekranın alt yarısında kalır (Google Haritalar gibi). */
const AHEAD_M = 35;
/** Rota çizgisi (geçilen/kalan ayrımı) konum bu kadar (m) değişince yeniden çizilir; her saniye çizmek uzun rotalarda haritayı kastırıyordu. */
const LINE_REFRESH_M = 15;
const VOICE_KEY = 'yola.navVoice';

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
  const lastUi = useRef(0);
  const { width } = useWindowDimensions();
  const CARD_GAP = Spacing.sm;
  const cardWidth = width - Spacing.md * 2;
  const cardStride = cardWidth + CARD_GAP;
  const [step] = useState(0);
  const [following, setFollowing] = useState(true);
  // Üstteki adım kartlarında kaydırarak önizlenen adım (null: şu anki adım gösterilir).
  const [preview, setPreview] = useState<number | null>(null);
  const list = useRef<FlatList<RouteStepWithTickets>>(null);
  const [theme, setTheme] = useState<MapTheme>('auto');
  const [satellite, setSatellite] = useState(false);
  // Sesli yönlendirme açık/kapalı (telefonda hatırlanır).
  const [voice, setVoice] = useState(true);
  useEffect(() => {
    AsyncStorage.getItem(VOICE_KEY)
      .then((v) => v === 'off' && setVoice(false))
      .catch(() => undefined);
  }, []);
  function toggleVoice() {
    setVoice((on) => {
      if (on) stopSpeaking();
      AsyncStorage.setItem(VOICE_KEY, on ? 'off' : 'on').catch(() => undefined);
      return !on;
    });
  }
  const mapDark = theme === 'auto' ? isDark : theme === 'dark';
  // Üstteki ve alttaki paneller harita temasına uyar (açık haritada koyu yazı, koyu haritada açık yazı).
  const ui = Colors[mapDark ? 'dark' : 'light'];
  // Adım çizgileri: yürüyüş noktalı, toplu taşıma hat renginde, araba düz çizilir.
  const stepPaths = useMemo(() => route.steps.map((st) => st.polylines.map((pl) => thin(decodePolyline(pl)))), [route.steps]);
  const stepFlat = useMemo(() => stepPaths.map((parts) => parts.flat()), [stepPaths]);
  // Çizgi konumu: yalnızca 15 m'den fazla ilerlenince güncellenir (konum geri çağrısında).
  const [lineHere, setLineHere] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!visible) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || !alive) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 1, timeInterval: 1000 }, (p) => {
        const heading = p.coords.heading !== null && p.coords.heading >= 0 ? p.coords.heading : null;
        const at = Date.now();
        fix.current = { lat: p.coords.latitude, lng: p.coords.longitude, heading, speed: p.coords.speed !== null && p.coords.speed >= 0 ? p.coords.speed : null, at };
        // Kamera ve konum işareti her güncellemeyi kullanır; yazılar ve adım hesabı saniyeden sık yenilenmez (her render tüm rotayı tarıyordu).
        if (at - lastUi.current < UI_REFRESH_MS) return;
        lastUi.current = at;
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude, heading });
        const now = { lat: p.coords.latitude, lng: p.coords.longitude };
        setLineHere((prev) => (prev && (remainingMeters(prev, [now]) ?? 0) < LINE_REFRESH_M ? prev : now));
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
  const lastCamera = useRef<{ lat: number; lng: number; heading: number; zoom: number } | null>(null);
  useEffect(() => {
    if (!visible || !live) return;
    fitted.current = false;
    lastCamera.current = null;
    const id = setInterval(() => {
      const f = fix.current;
      if (!f) return;
      const c = camera.current;
      if (f.heading !== null && (f.speed ?? 0) >= 0.7) c.heading = c.init ? blendHeading(c.heading, f.heading, 0.25) : f.heading;
      c.zoom = c.init ? c.zoom + (zoomForSpeed(f.speed) - c.zoom) * 0.08 : zoomForSpeed(f.speed);
      c.init = true;
      const at = destinationPoint(predictPosition(f, Date.now()), c.heading, AHEAD_M);
      const last = lastCamera.current;
      if (last) {
        const metersMoved = Math.hypot((at.lat - last.lat) * 111_320, (at.lng - last.lng) * 111_320 * Math.cos((at.lat * Math.PI) / 180));
        const headingMoved = Math.abs(((c.heading - last.heading + 540) % 360) - 180);
        if (metersMoved < CAM_MIN_MOVE_M && headingMoved < CAM_MIN_HEADING && Math.abs(c.zoom - last.zoom) < CAM_MIN_ZOOM) return;
      }
      lastCamera.current = { lat: at.lat, lng: at.lng, heading: c.heading, zoom: c.zoom };
      map.current?.animateCamera({ center: { latitude: at.lat, longitude: at.lng }, heading: c.heading, zoom: c.zoom, pitch: 45 }, { duration: TICK_MS });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [visible, live]);
  // Önizleme: tüm rota görünür.
  useEffect(() => {
    if (!visible || live || !following || fitted.current || coords.length < 2) return;
    fitted.current = true;
    map.current?.fitToCoordinates(coords, { edgePadding: { top: insets.top + 180, right: 48, bottom: 260, left: 48 }, animated: true });
  }, [visible, live, following, coords, insets.top]);

  // Varış kuş uçuşu yakınlıkla, gösterilen kalan mesafe ise rota boyunca hesaplanır (kuş uçuşu ile rota arasındaki tutarsızlık olmasın).
  const arrived = !off && isArrived(remainingMeters(here, path));
  const remaining = remainingAlongPath(here, path);
  const steps = route.steps;
  // Canlı takipte güncel adım konumdan bulunur; önizlemede (ya da konum yokken) ok düğmeleriyle gezilir.
  const auto = Boolean(here) && !off;
  const idx = Math.max(0, Math.min(auto ? currentStepIndex(here, stepFlat, step) : step, steps.length - 1));
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
      else if (lineHere) {
        const { passed, rest } = splitAtNearest(parts, lineHere);
        passed.forEach((pts, j) => add(`p${i}-${j}`, pts, PASSED, 2));
        rest.forEach((pts, j) => add(`r${i}-${j}`, pts, color, 2));
      } else parts.forEach((pts, j) => add(`s${i}-${j}`, pts, color, 2));
    });
    return lines;
  }, [stepPaths, route.steps, path, auto, idx, lineHere]);
  const tr = current?.transit;
  const next = steps[idx + 1];
  const end = coords[coords.length - 1];
  // Bu adımın bitimine (bir sonraki dönüşe) kalan mesafe.
  const stepEnd = stepPaths[idx]?.flat().at(-1);
  const stepLeft = stepEnd ? remainingMeters(here, [stepEnd]) : null;

  const stepLabel = (st: RouteStepWithTickets) =>
    st.transit ? [st.transit.lineShort ?? st.transit.line ?? st.transit.vehicleName, st.transit.headsign ? `→ ${st.transit.headsign}` : null].filter(Boolean).join(' ') : (st.instruction ?? t('route.walk', { count: st.durationMin }));
  const stepIcon = (st: RouteStepWithTickets) => (st.transit ? VEHICLE_ICONS[st.transit.vehicle] : st.mode !== 'transit' && st.maneuver ? TURN_ICON[turnIcon(st.maneuver)] : 'walk');
  const thenText = next ? t('route.nav.then', { next: next.transit ? (next.transit.lineShort ?? next.transit.line ?? next.transit.vehicleName ?? '') : (next.instruction ?? t('route.walk', { count: next.durationMin })) }) : t('route.nav.lastStep');

  // Şu anki adım değişince (canlı takip) kart listesi ona kayar; önizleme sırasında kullanıcının seçimi korunur.
  useEffect(() => {
    if (preview === null && steps.length > 1) list.current?.scrollToOffset({ offset: idx * cardStride, animated: true });
  }, [idx, preview, steps.length, cardStride]);
  // Kart kaydırılınca: şu anki adım dışındaysa harita o adımın başına gider (önizleme); şu anki adıma dönülürse takip sürer.
  function onCardSettled(offsetX: number) {
    const i = Math.max(0, Math.min(Math.round(offsetX / cardStride), steps.length - 1));
    if (i === idx) {
      setPreview(null);
      return;
    }
    setPreview(i);
    setFollowing(false);
    const first = stepFlat[i]?.[0];
    if (first) map.current?.animateCamera({ center: { latitude: first.lat, longitude: first.lng }, heading: 0, zoom: 17, pitch: 0 }, { duration: 500 });
  }
  function recenter() {
    setPreview(null);
    setFollowing(true);
  }

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
    if (!visible || !live || !auto || !voice || !current?.instruction) return;
    if (spokenStep.current === idx) return;
    spokenStep.current = idx;
    // Yola'nın doğal sesiyle (yoksa telefonun sesiyle), uygulama dilinde.
    speakNatural(current.instruction, translateLanguage(i18n.language).speech);
  }, [visible, live, auto, voice, idx, current, i18n.language]);
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

  // Harita içeriği konum her yenilendiğinde yeniden kurulmasın: yalnızca çizgiler, tema ya da varış değişince.
  const mapContent = useMemo(
    () => (
      <>
        {/* Yol: koyu kenarlıklı düz çizgi (her haritada okunur). Toplu taşıma hat renginde; geçilen kısım gri. */}
        {routeLines.map((l) => (
          <Fragment key={l.key}>
            <Polyline coordinates={l.coords} strokeColor={mapDark ? 'rgba(5,8,18,0.85)' : 'rgba(255,255,255,0.95)'} strokeWidth={l.width + 4} lineJoin="round" lineCap="round" zIndex={l.z} />
            <Polyline coordinates={l.coords} strokeColor={l.color} strokeWidth={l.width} lineJoin="round" lineCap="round" zIndex={l.z + 1} />
          </Fragment>
        ))}
        {end && <Marker coordinate={end} title={destinationName} />}
      </>
    ),
    [routeLines, mapDark, end, destinationName],
  );

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
            showsBuildings={false}
            toolbarEnabled={false}
            onPanDrag={() => setFollowing(false)}>
            {mapContent}
          </MapView>
        ) : (
          <View style={styles.center}>
            <Txt variant="body" color="textSecondary">
              {t('route.nav.noMap')}
            </Txt>
          </View>
        )}

        {arrived || off || steps.length === 0 ? (
          <View style={[styles.top, { top: insets.top + Spacing.sm, backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
            {rerouting && (
              <Txt variant="caption" style={{ color: ui.warning }}>
                {t('route.nav.rerouting')}
              </Txt>
            )}
            {arrived ? (
              <Txt variant="title">{t('route.nav.arrived')}</Txt>
            ) : (
              <View style={styles.row}>
                <Ionicons name="information-circle" size={26} color={ui.warning} />
                <Txt variant="bodyStrong" style={styles.flex}>
                  {here && remaining !== null ? t('route.nav.farFromStart', { distance: formatDistance(distanceToStart(here, path)) }) : t('route.nav.locating')}
                </Txt>
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.stepList, { top: insets.top + Spacing.sm }]}>
            {rerouting && (
              <View style={[styles.reroute, { backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
                <Txt variant="caption" style={{ color: ui.warning }}>
                  {t('route.nav.rerouting')}
                </Txt>
              </View>
            )}
            <FlatList
              ref={list}
              horizontal
              data={steps}
              keyExtractor={(_, i) => String(i)}
              showsHorizontalScrollIndicator={false}
              snapToInterval={cardStride}
              decelerationRate="fast"
              contentContainerStyle={{ paddingHorizontal: Spacing.md, gap: CARD_GAP }}
              getItemLayout={(_, i) => ({ length: cardStride, offset: cardStride * i, index: i })}
              onMomentumScrollEnd={(e) => onCardSettled(e.nativeEvent.contentOffset.x)}
              initialScrollIndex={Math.min(idx, steps.length - 1)}
              renderItem={({ item: st, index }) => {
                const isCurrent = index === idx;
                const dist = isCurrent && auto && stepLeft !== null ? stepLeft : st.distanceM;
                const place = st.transit?.from && st.transit?.to ? `${st.transit.from} → ${st.transit.to}` : null;
                return (
                  <View style={[styles.stepCard, { width: cardWidth, backgroundColor: ui.backgroundElevated, borderColor: isCurrent ? ui.primary : ui.border }]}>
                    <View style={styles.row}>
                      <Ionicons name={stepIcon(st)} size={30} color={isCurrent ? ui.primary : ui.textSecondary} />
                      <View style={styles.flex}>
                        <Txt variant="caption" color="textSecondary">
                          {[dist > 15 ? formatDistance(dist) : null, isCurrent ? null : t('route.nav.stepOf', { n: index + 1, total: steps.length })].filter(Boolean).join(' · ')}
                        </Txt>
                        <Txt variant="title" numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.8}>
                          {stepLabel(st)}
                        </Txt>
                        {place && (
                          <Txt variant="caption" color="textSecondary" numberOfLines={1}>
                            {place}
                          </Txt>
                        )}
                      </View>
                    </View>
                    {isCurrent && (
                      <Txt variant="caption" color="textMuted" numberOfLines={1}>
                        {thenText}
                      </Txt>
                    )}
                  </View>
                );
              }}
            />
          </View>
        )}

        <View style={[styles.controls, { top: insets.top + 130 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.theme')} onPress={() => setTheme((v) => (v === 'auto' ? 'light' : v === 'light' ? 'dark' : 'auto'))} style={[styles.control, { backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
            <Ionicons name={theme === 'auto' ? 'contrast' : theme === 'light' ? 'sunny' : 'moon'} size={22} color={ui.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t(voice ? 'route.nav.voiceOff' : 'route.nav.voiceOn')} accessibilityState={{ selected: voice }} onPress={toggleVoice} style={[styles.control, { backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
            <Ionicons name={voice ? 'volume-high' : 'volume-mute'} size={22} color={voice ? ui.primary : ui.textMuted} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.satellite')} onPress={() => setSatellite((v) => !v)} style={[styles.control, { backgroundColor: satellite ? ui.primary : ui.backgroundElevated, borderColor: ui.border }]}>
            <Ionicons name="earth" size={22} color={satellite ? ui.onPrimary : ui.primary} />
          </Pressable>
        </View>

        {!following && !off && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.recenter')} onPress={recenter} style={[styles.recenter, { bottom: insets.bottom + 150, backgroundColor: ui.backgroundElevated, borderColor: ui.border }]}>
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
  stepList: { position: 'absolute', left: 0, right: 0 },
  stepCard: { gap: Spacing.xs, padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: 1.5 },
  reroute: { alignSelf: 'center', paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.pill, borderWidth: 1, marginBottom: Spacing.xs },
  flex: { flex: 1 },
  controls: { position: 'absolute', right: Spacing.md, gap: Spacing.sm },
  control: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stop: { height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  recenter: { position: 'absolute', right: Spacing.md, width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.md, padding: Spacing.lg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1 },
});
