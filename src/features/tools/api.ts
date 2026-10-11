import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { VisaInfo } from '../../../supabase/functions/_shared/travel-info.ts';

function useEnabled(extra = true) {
  return useSessionStore((s) => Boolean(s.session)) && isSupabaseConfigured() && extra;
}

// ---------------------------------------------------------------------------
// Harcamalar
// ---------------------------------------------------------------------------

export const EXPENSE_CATEGORIES = ['food', 'transport', 'accommodation', 'activity', 'shopping', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export type ExpenseRow = {
  id: string;
  amount: number;
  currency: string;
  amount_in_budget_currency: number | null;
  category: ExpenseCategory;
  description: string | null;
  paid_by_name: string | null;
  spent_at: string;
  expense_shares: { participant_name: string; share_amount: number }[];
};

export function useExpenses(tripId: string | undefined) {
  return useQuery({
    queryKey: ['expenses', tripId],
    enabled: useEnabled(Boolean(tripId)),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('expenses')
        .select('id, amount, currency, amount_in_budget_currency, category, description, paid_by_name, spent_at, expense_shares(participant_name, share_amount)')
        .eq('trip_id', tripId!)
        .order('spent_at', { ascending: false });
      if (error) throw error;
      return (data as unknown as ExpenseRow[]).map((e) => ({
        ...e,
        amount: Number(e.amount),
        amount_in_budget_currency: e.amount_in_budget_currency === null ? null : Number(e.amount_in_budget_currency),
        expense_shares: e.expense_shares.map((s) => ({ ...s, share_amount: Number(s.share_amount) })),
      }));
    },
  });
}

/**
 * Döviz kuru (Avrupa Merkez Bankası verisi, frankfurter.dev; anahtar gerekmez).
 * Desteklenmeyen para biriminde null döner; harcama yine kaydedilir.
 */
export async function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  try {
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(from)}&symbols=${encodeURIComponent(to)}`);
    if (!res.ok) return null;
    const data = await res.json();
    const rate = data?.rates?.[to];
    return typeof rate === 'number' ? rate : null;
  } catch {
    return null;
  }
}

export function useAddExpense(tripId: string, budgetCurrency: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { amount: number; currency: string; category: ExpenseCategory; description: string; paidBy: string; participants: string[] }) => {
      const rate = await fetchRate(input.currency, budgetCurrency);
      const { error } = await getSupabase().rpc('add_expense', {
        p_trip_id: tripId,
        p_amount: input.amount,
        p_currency: input.currency,
        p_amount_in_budget_currency: rate === null ? (null as unknown as number) : Math.round(input.amount * rate * 100) / 100,
        p_category: input.category,
        p_description: input.description,
        p_paid_by_name: input.paidBy,
        p_participants: input.participants,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', tripId] }),
  });
}

export function useDeleteExpense(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('expenses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['expenses', tripId] }),
  });
}

// ---------------------------------------------------------------------------
// Bavul listesi
// ---------------------------------------------------------------------------

export type PackingRow = { id: string; label: string; category: string | null; quantity: number; is_packed: boolean; source: 'ai' | 'manual'; position: number };

export function usePacking(tripId: string | undefined) {
  return useQuery({
    queryKey: ['packing', tripId],
    enabled: useEnabled(Boolean(tripId)),
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .from('packing_items')
        .select('id, label, category, quantity, is_packed, source, position')
        .eq('trip_id', tripId!)
        .order('position');
      if (error) throw error;
      return data as PackingRow[];
    },
  });
}

export function usePackingMutations(tripId: string) {
  const queryClient = useQueryClient();
  const key = ['packing', tripId];
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const add = useMutation({
    mutationFn: async (items: { label: string; category: string | null; quantity: number; source: 'ai' | 'manual' }[]) => {
      const current = queryClient.getQueryData<PackingRow[]>(key) ?? [];
      const start = current.reduce((m, x) => Math.max(m, x.position + 1), 0);
      const { error } = await getSupabase()
        .from('packing_items')
        .insert(items.map((i, n) => ({ ...i, trip_id: tripId, position: start + n })));
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  const toggle = useMutation({
    mutationFn: async (item: PackingRow) => {
      const { error } = await getSupabase().from('packing_items').update({ is_packed: !item.is_packed }).eq('id', item.id);
      if (error) throw error;
    },
    // Anında işaretlensin; hata olursa geri alınır.
    onMutate: async (item) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<PackingRow[]>(key);
      queryClient.setQueryData<PackingRow[]>(key, (rows) => rows?.map((r) => (r.id === item.id ? { ...r, is_packed: !r.is_packed } : r)));
      return { previous };
    },
    onError: (_e, _item, ctx) => ctx?.previous && queryClient.setQueryData(key, ctx.previous),
    onSettled: refresh,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('packing_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
  });
  return { add, toggle, remove };
}

// ---------------------------------------------------------------------------
// Vize bilgisi ve profil
// ---------------------------------------------------------------------------

export function useProfileCountries() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['profile', userId, 'countries'],
    enabled: useEnabled(Boolean(userId)),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('profiles').select('passport_country, home_country, home_currency').eq('id', userId!).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useSavePassport() {
  const queryClient = useQueryClient();
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useMutation({
    mutationFn: async (country: string) => {
      const { error } = await getSupabase().from('profiles').update({ passport_country: country }).eq('id', userId!);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile', userId, 'countries'] }),
  });
}

export type VisaResult = VisaInfo & { passport: string; destination: string };
export type ToolErrorCode = 'quota_exceeded' | 'not_configured' | 'ai_failed' | 'network';

export class ToolError extends Error {
  constructor(readonly code: ToolErrorCode) {
    super(code);
  }
}

export function useVisaInfo(passport: string | null, destination: string | null) {
  return useQuery({
    queryKey: ['visa', passport, destination],
    enabled: useEnabled(Boolean(passport && destination)),
    staleTime: 7 * 24 * 60 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await getSupabase().functions.invoke('travel-info', { body: { passport, destination } });
      if (error) {
        const code = error instanceof FunctionsHttpError ? (await error.context.json().catch(() => null))?.error?.code : null;
        throw new ToolError(code === 'quota_exceeded' || code === 'not_configured' ? code : error instanceof FunctionsHttpError ? 'ai_failed' : 'network');
      }
      return data as VisaResult;
    },
  });
}
