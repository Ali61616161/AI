import type Ionicons from '@expo/vector-icons/Ionicons';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import * as WebBrowser from 'expo-web-browser';
import { Linking } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { NearbyCategory, Place } from '../../../supabase/functions/_shared/places.ts';
import type { DayForecast } from '../../../supabase/functions/_shared/weather.ts';

export type { NearbyCategory, Place, DayForecast };

type IconName = ComponentProps<typeof Ionicons>['name'];

export const NEARBY_CATEGORY_LIST: { key: NearbyCategory; icon: IconName }[] = [
  { key: 'restaurant', icon: 'restaurant-outline' },
  { key: 'cafe', icon: 'cafe-outline' },
  { key: 'bar', icon: 'wine-outline' },
  { key: 'dessert', icon: 'ice-cream-outline' },
  { key: 'bakery', icon: 'basket-outline' },
  { key: 'attraction', icon: 'camera-outline' },
  { key: 'museum', icon: 'business-outline' },
  { key: 'park', icon: 'leaf-outline' },
  { key: 'pharmacy', icon: 'medkit-outline' },
  { key: 'supermarket', icon: 'cart-outline' },
  { key: 'atm', icon: 'cash-outline' },
];

export type PlacesErrorCode = 'quota_exceeded' | 'not_configured' | 'upstream_failed' | 'network';

export class PlacesError extends Error {
  constructor(readonly code: PlacesErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'PlacesError';
  }
}

export async function invokePlaces<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('places', { body });
  if (error) {
    let code: PlacesErrorCode = 'network';
    if (error instanceof FunctionsHttpError) {
      const serverCode = (await error.context.json().catch(() => null))?.error?.code;
      code = serverCode === 'quota_exceeded' || serverCode === 'not_configured' ? serverCode : 'upstream_failed';
    }
    throw new PlacesError(code, error.message);
  }
  return data as T;
}

function useCanCall() {
  return useSessionStore((s) => Boolean(s.session)) && isSupabaseConfigured();
}

type Coords = { lat: number; lng: number };
export type OpenNowOptions = { radius?: number; limit?: 10 | 20 };

/** Önbellek anahtarı: konum ~100 m'ye yuvarlanır ki küçük oynamalar yeni istek (ve kota) harcamasın. */
export function openNowQuery(category: NearbyCategory, coords: Coords, options: OpenNowOptions = {}) {
  const lat = Math.round(coords.lat * 1000) / 1000;
  const lng = Math.round(coords.lng * 1000) / 1000;
  return {
    queryKey: ['open_now', category, lat, lng, options.radius ?? null, options.limit ?? 10] as const,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () =>
      invokePlaces<{ places: Place[] }>({ action: 'open_now', category, lat: coords.lat, lng: coords.lng, radius: options.radius, limit: options.limit }).then((r) => r.places),
  };
}

/** Konuma yakın, şu an açık yerler. */
export function useOpenNow(category: NearbyCategory, coords: Coords | null, options: OpenNowOptions = {}) {
  const canCall = useCanCall();
  const base = openNowQuery(category, coords ?? { lat: 0, lng: 0 }, options);
  return useQuery({
    ...base,
    enabled: canCall && coords !== null,
  });
}

export type HotelSuggestion = Place & { booking_url: string };
export type HotelsResult = { city: string; budget: string; checkin: string | null; checkout: string | null; places: HotelSuggestion[] };

export function useHotels(tripId: string | undefined, destinationId: string | null) {
  const canCall = useCanCall();
  return useQuery({
    queryKey: ['hotels', tripId, destinationId],
    enabled: canCall && Boolean(tripId),
    staleTime: 30 * 60_000,
    retry: false,
    queryFn: () => invokePlaces<HotelsResult>({ action: 'hotels', trip_id: tripId, destination_id: destinationId ?? undefined }),
  });
}

export type TripWeather = { days: (DayForecast & { city: string | null })[]; available_from: string | null };

/** Seyahat günlerinin hava tahmini (en fazla 10 gün ileri). Anahtar yoksa sessizce boş kalır. */
export function useTripWeather(tripId: string | undefined) {
  const canCall = useCanCall();
  return useQuery({
    queryKey: ['weather', tripId],
    enabled: canCall && Boolean(tripId),
    staleTime: 3 * 60 * 60_000,
    retry: false,
    queryFn: () => invokePlaces<TripWeather>({ action: 'weather', trip_id: tripId }),
  });
}

/** Mekanı Google Haritalar'da açar (uygulama yüklüyse uygulamada). */
export function openInMaps(place: { name: string; mapsUrl?: string | null; placeId?: string | null; lat?: number | null; lng?: number | null }) {
  if (place.mapsUrl && isHttps(place.mapsUrl)) return Linking.openURL(place.mapsUrl);
  const params = new URLSearchParams({ api: '1', query: place.lat != null && place.lng != null && !place.placeId ? `${place.lat},${place.lng}` : place.name });
  if (place.placeId) params.set('query_place_id', place.placeId);
  return Linking.openURL(`https://www.google.com/maps/search/?${params}`);
}

const isHttps = (url: string) => /^https:\/\//i.test(url);

/** Bilet ve otel bağlantılarını uygulama içi tarayıcıda açar (sadece https). */
export function openBookingLink(url: string) {
  if (!isHttps(url)) return Promise.resolve();
  return WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url));
}

export function formatDistance(meters: number | null, locale: string): string | null {
  if (meters === null) return null;
  if (meters < 1000) return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(Math.round(meters / 10) * 10)} m`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(meters / 1000)} km`;
}
