import Ionicons from '@expo/vector-icons/Ionicons';
import * as Location from 'expo-location';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { DARK_MAP_STYLE } from '@/features/explore/map-style';
import { mapProvider, nativeMapsAvailable, usesGoogleMap } from '@/features/map/availability';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { VEHICLE_ICONS, type RouteChoice } from './api';
import { formatDistance, isArrived, remainingMeters } from './navigation-logic';
import { decodePolyline, thin } from './polyline';

/**
 * Uygulama içi gezinme: harita seni takip eder, hedefe kalan mesafe canlı güncellenir ve adımlar
 * tek tek gösterilir. Adım geçişi elle yapılır (rota adımlarının koordinatı yok).
 */
export function NavigationView({ route, openExternalUrl, onStop }: { route: RouteChoice; openExternalUrl: string; onStop: () => void }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const map = useRef<MapView>(null);
  const path = useMemo(() => (route.polyline ? thin(decodePolyline(route.polyline)) : []), [route.polyline]);
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let alive = true;
    (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted || !alive) return;
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.High, distanceInterval: 10, timeInterval: 3000 }, (p) => {
        const c = { lat: p.coords.latitude, lng: p.coords.longitude };
        setHere(c);
        map.current?.animateCamera({ center: { latitude: c.lat, longitude: c.lng }, zoom: 17, ...(p.coords.heading && p.coords.heading >= 0 ? { heading: p.coords.heading } : {}) }, { duration: 600 });
      });
      if (!alive) sub.remove();
    })();
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);

  const remaining = remainingMeters(here, path);
  const arrived = isArrived(remaining);
  const steps = route.steps;
  const current = steps[Math.min(step, steps.length - 1)];
  const tr = current?.transit;
  const coords = path.map((p) => ({ latitude: p.lat, longitude: p.lng }));
  const end = coords[coords.length - 1];

  return (
    <View style={styles.wrap}>
      <View style={[styles.map, { borderColor: colors.border }]}>
        {nativeMapsAvailable ? (
          <MapView
            provider={mapProvider}
            ref={map}
            style={StyleSheet.absoluteFill}
            initialRegion={coords[0] ? { ...coords[0], latitudeDelta: 0.01, longitudeDelta: 0.01 } : undefined}
            userInterfaceStyle={isDark ? 'dark' : 'light'}
            customMapStyle={usesGoogleMap && isDark ? DARK_MAP_STYLE : undefined}
            showsUserLocation
            showsMyLocationButton={false}
            showsCompass={false}
            toolbarEnabled={false}>
            {coords.length > 1 && <Polyline coordinates={coords} strokeColor={colors.primary} strokeWidth={6} lineJoin="round" />}
            {end && <Marker coordinate={end} title={t('route.nav.destination')} />}
          </MapView>
        ) : (
          <View style={styles.center}>
            <Text variant="body" color="textSecondary">
              {t('route.nav.noMap')}
            </Text>
          </View>
        )}
      </View>

      <Card variant="glow">
        {arrived ? (
          <Text variant="subtitle">{t('route.nav.arrived')}</Text>
        ) : (
          <>
            <Text variant="caption" color="textSecondary">
              {remaining !== null ? t('route.nav.remaining', { distance: formatDistance(remaining) }) : t('route.nav.locating')}
            </Text>
            {current && (
              <View style={styles.stepRow}>
                <Ionicons name={tr ? VEHICLE_ICONS[tr.vehicle] : 'walk'} size={22} color={colors.primary} />
                <Text variant="bodyStrong" style={styles.flex}>
                  {tr
                    ? [tr.lineShort ?? tr.line ?? tr.vehicleName, tr.headsign ? `→ ${tr.headsign}` : null, tr.from && tr.to ? `(${tr.from} → ${tr.to})` : null].filter(Boolean).join(' ')
                    : t('route.walk', { count: current.durationMin })}
                </Text>
              </View>
            )}
            {steps.length > 1 && (
              <View style={styles.stepNav}>
                <Button title={t('route.nav.prev')} variant="secondary" disabled={step === 0} onPress={() => setStep((s) => Math.max(s - 1, 0))} style={styles.flex} />
                <Text variant="caption" color="textMuted">
                  {t('route.nav.stepOf', { current: Math.min(step, steps.length - 1) + 1, total: steps.length })}
                </Text>
                <Button title={t('route.nav.next')} disabled={step >= steps.length - 1} onPress={() => setStep((s) => Math.min(s + 1, steps.length - 1))} style={styles.flex} />
              </View>
            )}
          </>
        )}
      </Card>

      <Button title={arrived ? t('route.nav.done') : t('route.nav.stop')} variant={arrived ? 'primary' : 'secondary'} onPress={onStop} />
      <Button title={t('route.nav.openGoogle')} variant="ghost" icon="open-outline" onPress={() => Linking.openURL(openExternalUrl)} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.md },
  map: { height: 380, borderRadius: Radius.lg, borderWidth: 1, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.lg },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  stepNav: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
});
