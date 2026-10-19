import * as Location from 'expo-location';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSessionStore } from '@/stores/session-store';

import { cityLabel, hasRegion } from './city-label';

/**
 * Eskiden sadece ilçe kaydedilmiş evleri "İl, İlçe" biçimine getirir (bir kez, kayıtlı konumdan
 * ya da şehir adından). Başarısız olursa eski ad olduğu gibi kalır.
 */
export function useHomeCityLabel() {
  const { homeCity, homeLat, homeLng } = useSessionStore((s) => s.identity);
  const setIdentity = useSessionStore((s) => s.setIdentity);

  useEffect(() => {
    if (!homeCity || hasRegion(homeCity) || Platform.OS === 'web') return;
    let alive = true;
    (async () => {
      try {
        let coords = homeLat !== null && homeLng !== null ? { latitude: homeLat, longitude: homeLng } : null;
        if (!coords) {
          const [found] = await Location.geocodeAsync(homeCity);
          if (found) coords = { latitude: found.latitude, longitude: found.longitude };
        }
        if (!coords) return;
        const [place] = await Location.reverseGeocodeAsync(coords);
        const label = cityLabel(place);
        if (alive && label && hasRegion(label)) setIdentity({ homeCity: label, ...(homeLat === null ? { homeLat: coords.latitude, homeLng: coords.longitude } : {}) });
      } catch {
        // ağ ya da geocoder yok: eski ad kalır
      }
    })();
    return () => {
      alive = false;
    };
  }, [homeCity, homeLat, homeLng, setIdentity]);
}
