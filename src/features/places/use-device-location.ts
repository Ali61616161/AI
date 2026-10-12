import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';

import { getCurrentLocation } from '@/features/plan/replan';

export type Coords = { lat: number; lng: number };
type Status = 'checking' | 'needs_permission' | 'locating' | 'ready' | 'denied';

/**
 * Cihaz konumu. İzin daha önce verildiyse sormadan alır; verilmediyse `request()`
 * çağrılana kadar bekler (izin penceresi kullanıcının eylemiyle açılır).
 */
export function useDeviceLocation() {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<Status>('checking');

  const request = useCallback(async () => {
    setStatus('locating');
    const c = await getCurrentLocation();
    setCoords(c);
    setStatus(c ? 'ready' : 'denied');
    return c;
  }, []);

  useEffect(() => {
    let cancelled = false;
    Location.getForegroundPermissionsAsync()
      .then((p) => {
        if (cancelled) return;
        if (p.granted) request();
        else setStatus('needs_permission');
      })
      .catch(() => !cancelled && setStatus('needs_permission'));
    return () => {
      cancelled = true;
    };
  }, [request]);

  return { coords, status, request };
}
