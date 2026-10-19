import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { DARK_MAP_STYLE } from '@/features/explore/map-style';
import { mapProvider, nativeMapsAvailable, usesGoogleMap } from '@/features/map/availability';
import { Colors, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { VEHICLE_ICONS, type RouteChoice } from './api';
import { currentStepIndex, formatDistance, isArrived, isOffRoute, nearestIndex, remainingMeters, turnIcon, type TurnIcon } from './navigation-logic';
import { decodePolyline, thin } from './polyline';

const LINE = '#FF5A36';

/** Harita temasına göre panel renkleri (açık haritada koyu yazı, koyu haritada açık yazı). */
const UiColors = createContext<(typeof Colors)[keyof typeof Colors]>(Colors.dark);

function Txt({ color, style, ...rest }: React.ComponentProps<typeof Text>) {
  const ui = useContext(UiColors);
  return <Text {...rest} style={[style, { color: color === 'textSecondary' ? ui.textSecondary : color === 'textMuted' ? ui.textMuted : ui.text }]} />;
}

type MapTheme = 'auto' | 'light' | 'dark';
const TURN_ICON: Record<TurnIcon, 'arrow-up' | 'arrow-back' | 'arrow-forward' | 'refresh'> = { straight: 'arrow-up', left: 'arrow-back', right: 'arrow-forward', uturn: 'refresh' };

type Props = { visible: boolean; route: RouteChoice; googleUrl: string; destinationName: string; onClose: () => void };

/**
 * Tam ekran gezinme: harita seni yönüne göre takip eder, üstte sıradaki adım, altta kalan mesafe.
 * Başlangıç noktasından uzaksan canlı takip yerine rotanın tamamı önizlenir.
 */
export function NavigationView({ visible, route, googleUrl, destinationName, onClose }: Props) {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<MapView>(null);
  const path = useMemo(() => (route.polyline ? thin(decodePolyline(route.polyline)) : []), [route.polyline]);
  const coords = useMemo(() => path.map((p) => ({ latitude: p.lat, longitude: p.lng })), [path]);
  const [here, setHere] = useState<{ lat: number; lng: number; heading: number | null } | null>(null);
  const [step, setStep] = useState(0);
  const [following, setFollowing] = useState(true);
  const [theme, setTheme] = useState<MapTheme>('auto');
  const [satellite, setSatellite] = useState(false);
  const mapDark = theme === 'auto' ? isDark : theme === 'dark';
  // Üstteki ve alttaki paneller harita temasına uyar (açık haritada koyu yazı, koyu haritada açık yazı).
  const ui = Colors[mapDark ? 'dark' : 'light'];
  // Adım çizgileri: yürüyüş noktalı, toplu taşıma hat renginde, araba düz çizilir.
  const stepPaths = useMemo(() => route.steps.map((st) => st.polylines.map((pl) => thin(decodePolyline(pl)))), [route.steps]);
  const stepCoords = useMemo(() => stepPaths.map((parts) => parts.map((part) => part.map((p) => ({ latitude: p.lat, longitude: p.lng })))), [stepPaths]);

  useEffect(() => {
    if (!visible) return;
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || !alive) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 8, timeInterval: 2000 }, (p) =>
        setHere({ lat: p.coords.latitude, lng: p.coords.longitude, heading: p.coords.heading !== null && p.coords.heading >= 0 ? p.coords.heading : null }),
      );
      if (!alive) sub.remove();
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, [visible]);

  const off = isOffRoute(here, path);
  const live = !off && following;

  // Canlı takip: kamera konumuna, yönüne ve hafif eğik açıya gider. Önizlemede tüm rota görünür.
  useEffect(() => {
    if (!visible) return;
    if (live && here) {
      map.current?.animateCamera({ center: { latitude: here.lat, longitude: here.lng }, zoom: 18, pitch: 50, ...(here.heading !== null ? { heading: here.heading } : {}) }, { duration: 700 });
    } else if (coords.length > 1) {
      map.current?.fitToCoordinates(coords, { edgePadding: { top: insets.top + 180, right: 48, bottom: 260, left: 48 }, animated: true });
    }
  }, [visible, live, here, coords, insets.top]);

  const passedIndex = here && !off ? nearestIndex(here, path) : 0;
  const passedCoords = useMemo(() => coords.slice(0, passedIndex + 1), [coords, passedIndex]);
  const remaining = remainingMeters(here, path);
  const arrived = !off && isArrived(remaining);
  const steps = route.steps;
  // Canlı takipte güncel adım konumdan bulunur; önizlemede (ya da konum yokken) ok düğmeleriyle gezilir.
  const auto = Boolean(here) && !off;
  const idx = Math.max(0, Math.min(auto ? currentStepIndex(here, stepPaths.map((parts) => parts.flat()), step) : step, steps.length - 1));
  const current = steps[idx];
  const tr = current?.transit;
  const next = steps[idx + 1];
  const end = coords[coords.length - 1];

  const instruction = tr
    ? [tr.lineShort ?? tr.line ?? tr.vehicleName, tr.headsign ? `→ ${tr.headsign}` : null].filter(Boolean).join(' ')
    : current
      ? (current.instruction ?? t('route.walk', { count: current.durationMin }))
      : destinationName;
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
            {/* Kalan yol: yürüyüş noktalı, toplu taşıma hat renginde; geçilen kısım üstte soluk gri. */}
            {stepCoords.some((parts) => parts.length > 0)
              ? stepCoords.flatMap((parts, i) =>
                  parts.map((part, j) =>
                    route.steps[i].transit ? (
                      <Polyline key={`s${i}-${j}`} coordinates={part} strokeColor={route.steps[i].transit?.color ?? LINE} strokeWidth={7} lineJoin="round" />
                    ) : route.steps[i].mode === 'walk' ? (
                      <Fragment key={`s${i}-${j}`}>
                        {/* İnce düz çizgi rotayı belli eder; üstündeki büyük noktalar yürüyüşü gösterir. */}
                        <Polyline coordinates={part} strokeColor={LINE} strokeWidth={2} />
                        <Polyline coordinates={part} strokeColor={LINE} strokeWidth={9} lineCap="round" lineDashPattern={[1, 14]} />
                      </Fragment>
                    ) : (
                      <Polyline key={`s${i}-${j}`} coordinates={part} strokeColor={LINE} strokeWidth={7} lineJoin="round" />
                    ),
                  ),
                )
              : coords.length > 1 && <Polyline coordinates={coords} strokeColor={LINE} strokeWidth={7} lineJoin="round" />}
            {passedCoords.length > 1 && <Polyline coordinates={passedCoords} strokeColor="rgba(150,160,185,0.85)" strokeWidth={8} lineJoin="round" zIndex={5} />}
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
                  <Txt variant="title" numberOfLines={2}>
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
            <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.openGoogle')} onPress={() => Linking.openURL(googleUrl)} hitSlop={8} style={[styles.control, { backgroundColor: ui.surfaceMuted, borderColor: ui.border }]}>
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
