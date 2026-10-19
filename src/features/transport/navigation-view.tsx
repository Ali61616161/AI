import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { DARK_MAP_STYLE } from '@/features/explore/map-style';
import { mapProvider, nativeMapsAvailable, usesGoogleMap } from '@/features/map/availability';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { VEHICLE_ICONS, type RouteChoice } from './api';
import { currentStepIndex, formatDistance, isArrived, isOffRoute, nearestIndex, remainingMeters, turnIcon, type TurnIcon } from './navigation-logic';
import { decodePolyline, thin } from './polyline';

type MapTheme = 'auto' | 'light' | 'dark';
const TURN_ICON: Record<TurnIcon, 'arrow-up' | 'arrow-back' | 'arrow-forward' | 'refresh'> = { straight: 'arrow-up', left: 'arrow-back', right: 'arrow-forward', uturn: 'refresh' };

type Props = { visible: boolean; route: RouteChoice; googleUrl: string; destinationName: string; onClose: () => void };

/**
 * Tam ekran gezinme: harita seni yönüne göre takip eder, üstte sıradaki adım, altta kalan mesafe.
 * Başlangıç noktasından uzaksan canlı takip yerine rotanın tamamı önizlenir.
 */
export function NavigationView({ visible, route, googleUrl, destinationName, onClose }: Props) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
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
      <View style={[styles.fill, { backgroundColor: colors.background }]}>
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
                      <Polyline key={`s${i}-${j}`} coordinates={part} strokeColor={route.steps[i].transit?.color ?? colors.primary} strokeWidth={7} lineJoin="round" />
                    ) : route.steps[i].mode === 'walk' ? (
                      <Polyline key={`s${i}-${j}`} coordinates={part} strokeColor={colors.primary} strokeWidth={6} lineCap="round" lineDashPattern={[0.1, 12]} />
                    ) : (
                      <Polyline key={`s${i}-${j}`} coordinates={part} strokeColor={colors.primary} strokeWidth={7} lineJoin="round" />
                    ),
                  ),
                )
              : coords.length > 1 && <Polyline coordinates={coords} strokeColor={colors.primary} strokeWidth={7} lineJoin="round" />}
            {passedCoords.length > 1 && <Polyline coordinates={passedCoords} strokeColor="rgba(150,160,185,0.85)" strokeWidth={8} lineJoin="round" zIndex={5} />}
            {end && <Marker coordinate={end} title={destinationName} />}
          </MapView>
        ) : (
          <View style={styles.center}>
            <Text variant="body" color="textSecondary">
              {t('route.nav.noMap')}
            </Text>
          </View>
        )}

        <View style={[styles.top, { top: insets.top + Spacing.sm, backgroundColor: colors.surface, borderColor: colors.border }]}>
          {arrived ? (
            <Text variant="title">{t('route.nav.arrived')}</Text>
          ) : off ? (
            <View style={styles.row}>
              <Ionicons name="information-circle" size={26} color={colors.warning} />
              <Text variant="bodyStrong" style={styles.flex}>
                {here && remaining !== null ? t('route.nav.farFromStart', { distance: formatDistance(distanceToStart(here, path)) }) : t('route.nav.locating')}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.row}>
                <Ionicons name={tr ? VEHICLE_ICONS[tr.vehicle] : current && current.mode !== 'transit' && current.maneuver ? TURN_ICON[turnIcon(current.maneuver)] : 'walk'} size={30} color={colors.primary} />
                <View style={styles.flex}>
                  <Text variant="title" numberOfLines={2}>
                    {instruction}
                  </Text>
                  {detail && (
                    <Text variant="caption" color="textSecondary" numberOfLines={1}>
                      {detail}
                    </Text>
                  )}
                </View>
              </View>
              {steps.length > 1 && !auto && (
                <View style={styles.stepNav}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.prev')} disabled={idx === 0} onPress={() => setStep(Math.max(idx - 1, 0))} hitSlop={10} style={{ opacity: idx === 0 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-back-circle" size={32} color={colors.textSecondary} />
                  </Pressable>
                  <Text variant="caption" color="textMuted" style={styles.flex}>
                    {next ? t('route.nav.then', { next: next.transit ? (next.transit.lineShort ?? next.transit.line ?? next.transit.vehicleName ?? '') : t('route.walk', { count: next.durationMin }) }) : t('route.nav.lastStep')}
                  </Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.next')} disabled={idx >= steps.length - 1} onPress={() => setStep(Math.min(idx + 1, steps.length - 1))} hitSlop={10} style={{ opacity: idx >= steps.length - 1 ? 0.3 : 1 }}>
                    <Ionicons name="chevron-forward-circle" size={32} color={colors.primary} />
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        <View style={[styles.controls, { top: insets.top + 130 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.theme')} onPress={() => setTheme((v) => (v === 'auto' ? 'light' : v === 'light' ? 'dark' : 'auto'))} style={[styles.control, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name={theme === 'auto' ? 'contrast' : theme === 'light' ? 'sunny' : 'moon'} size={22} color={colors.primary} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.satellite')} onPress={() => setSatellite((v) => !v)} style={[styles.control, { backgroundColor: satellite ? colors.primary : colors.surface, borderColor: colors.border }]}>
            <Ionicons name="earth" size={22} color={satellite ? colors.onPrimary : colors.primary} />
          </Pressable>
        </View>

        {!following && !off && (
          <Pressable accessibilityRole="button" accessibilityLabel={t('route.nav.recenter')} onPress={() => setFollowing(true)} style={[styles.recenter, { bottom: insets.bottom + 150, backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Ionicons name="locate" size={24} color={colors.primary} />
          </Pressable>
        )}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + Spacing.md, backgroundColor: colors.surface, borderColor: colors.border }]}>
          {!off && remaining !== null && (
            <Text variant="title">{arrived ? t('route.nav.arrivedShort') : t('route.nav.remaining', { distance: formatDistance(remaining) })}</Text>
          )}
          <View style={styles.row}>
            <Button title={arrived ? t('route.nav.done') : t('route.nav.stop')} variant={arrived ? 'primary' : 'secondary'} onPress={onClose} style={styles.flex} />
            <Button title="" accessibilityLabel={t('route.nav.openGoogle')} icon="open-outline" variant="ghost" onPress={() => Linking.openURL(googleUrl)} />
          </View>
        </View>
      </View>
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
  recenter: { position: 'absolute', right: Spacing.md, width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, gap: Spacing.md, padding: Spacing.lg, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, borderWidth: 1 },
});
