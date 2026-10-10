import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import type { Enums } from '@/types/database';

type IconName = ComponentProps<typeof Ionicons>['name'];

export type Companion = Enums<'companion_type'>;
export type BudgetTier = Enums<'budget_tier'>;

export const COMPANIONS: { value: Companion; icon: IconName }[] = [
  { value: 'solo', icon: 'person-outline' },
  { value: 'couple', icon: 'heart-outline' },
  { value: 'family', icon: 'people-outline' },
  { value: 'friends', icon: 'beer-outline' },
];

export const BUDGETS: { value: BudgetTier; icon: IconName; color: 'budgetLow' | 'budgetMid' | 'budgetLux' }[] = [
  { value: 'low', icon: 'wallet-outline', color: 'budgetLow' },
  { value: 'mid', icon: 'card-outline', color: 'budgetMid' },
  { value: 'lux', icon: 'diamond-outline', color: 'budgetLux' },
];

/** profiles.interests ve trips.interests sütunlarında bu anahtarlar saklanır. */
export const INTERESTS: { value: string; icon: IconName }[] = [
  { value: 'art', icon: 'color-palette-outline' },
  { value: 'history', icon: 'library-outline' },
  { value: 'food', icon: 'restaurant-outline' },
  { value: 'nightlife', icon: 'moon-outline' },
  { value: 'nature', icon: 'leaf-outline' },
  { value: 'cars', icon: 'car-sport-outline' },
  { value: 'shopping', icon: 'bag-handle-outline' },
  { value: 'architecture', icon: 'business-outline' },
  { value: 'beach', icon: 'sunny-outline' },
  { value: 'sports', icon: 'football-outline' },
  { value: 'photography', icon: 'camera-outline' },
  { value: 'music', icon: 'musical-notes-outline' },
];

export const MIN_INTERESTS = 1;
