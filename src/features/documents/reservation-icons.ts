import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { ReservationType } from '../../../supabase/functions/_shared/documents.ts';

export const RESERVATION_ICONS: Record<ReservationType, ComponentProps<typeof Ionicons>['name']> = {
  flight: 'airplane',
  hotel: 'bed',
  train: 'train',
  bus: 'bus',
  car_rental: 'car',
  event: 'ticket',
  other: 'document-text',
};

export const TRANSPORT_TYPES: ReservationType[] = ['flight', 'train', 'bus'];
