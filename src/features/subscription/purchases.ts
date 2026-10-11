import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { planFor, productMapFromEnv, type Plan } from '../../../supabase/functions/_shared/subscriptions.ts';

// RevenueCat'in herkese açık SDK anahtarları (uygulamaya gömülebilir, gizli değildir).
const API_KEY = Platform.select({
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
  default: undefined,
});

/** Mağaza satın alması bu cihazda yapılabilir mi (web'de ve anahtar yokken hayır). */
export const purchasesAvailable = Boolean(API_KEY) && Platform.OS !== 'web';

const PRODUCTS = productMapFromEnv(() => undefined);
let configuredFor: string | null = null;

/** Oturum açan kullanıcıyla RevenueCat'i eşler (app_user_id = Supabase kullanıcı kimliği). */
export async function identifyPurchaser(userId: string | null) {
  if (!purchasesAvailable) return;
  try {
    if (configuredFor === null && userId) {
      Purchases.configure({ apiKey: API_KEY!, appUserID: userId });
      configuredFor = userId;
    } else if (userId && configuredFor !== userId) {
      await Purchases.logIn(userId);
      configuredFor = userId;
    } else if (!userId && configuredFor) {
      await Purchases.logOut();
      configuredFor = null;
    }
  } catch (e) {
    console.warn('RevenueCat eşlenemedi', e);
  }
}

export type PlanPackage = { plan: Plan; pkg: PurchasesPackage; priceString: string; price: number; currency: string };

export function useOfferings() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['offerings', userId],
    enabled: purchasesAvailable && Boolean(userId),
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<PlanPackage[]> => {
      await identifyPurchaser(userId);
      const offerings = await Purchases.getOfferings();
      const all = [...(offerings.current?.availablePackages ?? []), ...Object.values(offerings.all).flatMap((o) => o.availablePackages)];
      const byPlan = new Map<Plan, PlanPackage>();
      for (const pkg of all) {
        const plan = planFor(pkg.product.identifier, PRODUCTS);
        if (plan && !byPlan.has(plan)) byPlan.set(plan, { plan, pkg, priceString: pkg.product.priceString, price: pkg.product.price, currency: pkg.product.currencyCode });
      }
      return [...byPlan.values()];
    },
  });
}

/** Sunucudaki plan (abonelik kayıtları sadece sunucuda yazılır). */
export function useCurrentPlan(tripId?: string | null) {
  const signedIn = useSessionStore((s) => Boolean(s.session));
  return useQuery({
    queryKey: ['plan-status', tripId ?? null],
    enabled: signedIn && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('current_plan', { p_trip_id: tripId ?? undefined });
      if (error) throw error;
      return data as 'free' | Plan;
    },
  });
}

async function syncWithServer(body: Record<string, unknown>) {
  const { data, error } = await getSupabase().functions.invoke('subscription', { body });
  if (error) throw error;
  return data as { plan: string };
}

export class PurchaseCancelled extends Error {}

export function usePurchase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { item: PlanPackage; tripId?: string | null }) => {
      try {
        await Purchases.purchasePackage(input.item.pkg);
      } catch (e) {
        if ((e as { userCancelled?: boolean }).userCancelled) throw new PurchaseCancelled();
        throw e;
      }
      return input.item.plan === 'trip_pass' ? syncWithServer({ action: 'claim_trip_pass', trip_id: input.tripId }) : syncWithServer({ action: 'sync' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan-status'] });
      queryClient.invalidateQueries({ queryKey: ['quota'] });
    },
  });
}

export function useRestore() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await Purchases.restorePurchases();
      return syncWithServer({ action: 'sync' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan-status'] }),
  });
}

/** Mağazanın abonelik yönetim sayfası. */
export async function managementUrl(): Promise<string | null> {
  if (!purchasesAvailable) return null;
  try {
    return (await Purchases.getCustomerInfo()).managementURL;
  } catch {
    return null;
  }
}
