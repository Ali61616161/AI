import type { ComponentProps } from 'react';
import type Ionicons from '@expo/vector-icons/Ionicons';

import type { PlanOptions } from './plan-options-logic';

export type { PlanOptions } from './plan-options-logic';
export { buildPlanOptions, sameInterests } from './plan-options-logic';

type IconName = ComponentProps<typeof Ionicons>['name'];

export const PACES: { value: NonNullable<PlanOptions['pace']>; icon: IconName }[] = [
  { value: 'relaxed', icon: 'leaf-outline' },
  { value: 'balanced', icon: 'walk-outline' },
  { value: 'packed', icon: 'flash-outline' },
];

export const DIETS: { value: NonNullable<PlanOptions['diets']>[number]; icon: IconName }[] = [
  { value: 'vegetarian', icon: 'nutrition-outline' },
  { value: 'vegan', icon: 'leaf-outline' },
  { value: 'halal', icon: 'restaurant-outline' },
  { value: 'gluten_free', icon: 'ban-outline' },
];

