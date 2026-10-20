import type Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

import { invokePlaces } from '@/features/places/api';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { RouteMode, RouteOption, RouteStep, VehicleKind } from '../../../supabase/functions/_shared/routes.ts';
import type { TicketMode, TicketOption, TransportPartner } from '../../../supabase/functions/_shared/transport.ts';

export type { RouteMode, TicketMode, TicketOption, TransportPartner, VehicleKind };

type IconName = ComponentProps<typeof Ionicons>['name'];

export type RouteStepWithTickets = RouteStep & { tickets: TicketOption[] };
export type RouteChoice = Omit<RouteOption, 'steps'> & { steps: RouteStepWithTickets[] };
export type RouteResult = { mode: RouteMode; routes: RouteChoice[]; tickets: TicketOption[]; navigation_url: string };

export type RoutePoint = { lat: number; lng: number } | { address: string };
export type RouteRequest = {
  origin: RoutePoint | null;
  destination: RoutePoint | null;
  mode: RouteMode;
  originName?: string | null;
  destinationName?: string | null;
  countryCode?: string | null;
  departAt?: string | null;
};

/** "Nasıl giderim?": gerçek tarifelerle güzergah, işletmeci siteleri ve bilet bağlantıları. */
export function useRoute(req: RouteRequest, options: { keepPrevious?: boolean } = {}) {
  const canCall = useSessionStore((s) => Boolean(s.session)) && isSupabaseConfigured();
  return useQuery({
    queryKey: ['route', req],
    enabled: canCall && req.origin !== null && req.destination !== null,
    staleTime: 5 * 60_000,
    retry: false,
    // Gezinirken yeniden rota hesaplanırken eski rota ekranda kalır (gezinme penceresi kapanmasın).
    placeholderData: options.keepPrevious ? keepPreviousData : undefined,
    queryFn: () =>
      invokePlaces<RouteResult>({
        action: 'route',
        origin: req.origin,
        destination: req.destination,
        mode: req.mode,
        origin_name: req.originName ?? undefined,
        destination_name: req.destinationName ?? undefined,
        country_code: req.countryCode ?? undefined,
        depart_at: req.departAt ?? undefined,
      }),
  });
}

export const VEHICLE_ICONS: Record<VehicleKind, IconName> = {
  train: 'train',
  high_speed_train: 'train',
  subway: 'subway',
  tram: 'train-outline',
  bus: 'bus',
  ferry: 'boat',
  cable_car: 'trending-up',
  funicular: 'trending-up',
  other: 'navigate',
};

export const TICKET_ICONS: Record<TicketMode, IconName> = { train: 'train', bus: 'bus', ferry: 'boat', flight: 'airplane', car: 'car' };

export const PARTNER_NAMES: Record<TransportPartner, string> = {
  omio: 'Omio',
  trainline: 'Trainline',
  '12go': '12Go',
  ferryhopper: 'Ferryhopper',
  busbud: 'Busbud',
  kiwi: 'Kiwi.com',
  skyscanner: 'Skyscanner',
  discovercars: 'DiscoverCars',
  rome2rio: 'Rome2rio',
  google_flights: 'Google Flights',
};
