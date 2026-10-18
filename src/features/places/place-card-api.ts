import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { invokePlaces } from './api';

export type PlaceCardPhoto = { uri: string; author: string | null; authorUrl: string | null };

/** places Edge Function "place" eyleminin cevabı (Google Place Details + en fazla 4 fotoğraf). */
export type PlaceCard = {
  id: string;
  name: string;
  address: string | null;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
  priceLevel: number | null;
  mapsUrl: string | null;
  type: string | null;
  status: string | null;
  typeLabel: string | null;
  website: string | null;
  phone: string | null;
  summary: string | null;
  openNow: boolean | null;
  hours: string[];
  photos: PlaceCardPhoto[];
};

/** Fotoğraf adresleri kısa ömürlüdür; bu yüzden kısa süre önbellekte tutulur. */
export function usePlaceCard(placeId: string | undefined) {
  const canCall = useSessionStore((s) => Boolean(s.session)) && isSupabaseConfigured();
  return useQuery({
    queryKey: ['place-card', placeId],
    enabled: canCall && Boolean(placeId),
    staleTime: 20 * 60_000,
    retry: false,
    queryFn: async () => (await invokePlaces<{ place: PlaceCard }>({ action: 'place', place_id: placeId })).place,
  });
}

export type PlaceCardParams = { id: string; name: string; address?: string | null; lat?: number | null; lng?: number | null; mapsUrl?: string | null };

/** Mekân kartını açar; yükleme sırasında ve hata durumunda eldeki bilgiler gösterilir. */
export function openPlaceCard(p: PlaceCardParams) {
  router.push({
    pathname: '/place',
    params: {
      id: p.id,
      name: p.name,
      ...(p.address ? { address: p.address } : {}),
      ...(p.lat != null && p.lng != null ? { lat: String(p.lat), lng: String(p.lng) } : {}),
      ...(p.mapsUrl ? { mapsUrl: p.mapsUrl } : {}),
    },
  });
}
