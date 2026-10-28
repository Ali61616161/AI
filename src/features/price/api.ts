import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { normalizeDate, parsePoints, parseTarget, type WatchCurrency, type WatchForm } from './logic';

export type PriceWatch = {
  id: string;
  origin_code: string;
  origin_name: string;
  destination_code: string;
  destination_name: string;
  depart_on: string;
  return_on: string | null;
  flexible_month: boolean;
  target_price: number | null;
  currency: WatchCurrency;
  active: boolean;
  last_price: number | null;
  lowest_price: number | null;
  last_airline: string | null;
  last_checked_at: string | null;
  points: { d: string; p: number }[];
};

function useUserId() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

export function usePriceWatches() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['price-watches', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async (): Promise<PriceWatch[]> => {
      const { data, error } = await getSupabase()
        .from('price_watches')
        .select('id, origin_code, origin_name, destination_code, destination_name, depart_on, return_on, flexible_month, target_price, currency, active, last_price, lowest_price, last_airline, last_checked_at, price_points')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(({ price_points, ...w }) => ({ ...w, currency: w.currency as WatchCurrency, points: parsePoints(price_points) }));
    },
  });
}

export function useAddPriceWatch() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { form: WatchForm; currency: WatchCurrency }) => {
      const { form } = input;
      const depart = normalizeDate(form.depart, form.flexible)!;
      const ret = form.ret.trim() ? normalizeDate(form.ret, form.flexible) : null;
      const target = parseTarget(form.target);
      const { error } = await getSupabase()
        .from('price_watches')
        .insert({
          origin_code: form.origin!.code,
          origin_name: form.origin!.name,
          destination_code: form.destination!.code,
          destination_name: form.destination!.name,
          depart_on: depart,
          return_on: ret,
          flexible_month: form.flexible,
          target_price: target === 'invalid' ? null : target,
          currency: input.currency,
        });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-watches', userId] }),
  });
}

export function useUpdatePriceWatch() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: { id: string; active?: boolean; target?: number | null }) => {
      const patch: { active?: boolean; target_price?: number | null } = {};
      if (input.active !== undefined) patch.active = input.active;
      if (input.target !== undefined) patch.target_price = input.target;
      const { error } = await getSupabase().from('price_watches').update(patch).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-watches', userId] }),
  });
}

export function useDeletePriceWatch() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('price_watches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['price-watches', userId] }),
  });
}

export type PlaceHit = { code: string; name: string; country: string };

const AUTOCOMPLETE = 'https://autocomplete.travelpayouts.com/places2';
const LOCALES = new Set(['en', 'ru', 'de', 'es', 'fr', 'it', 'tr', 'zh', 'ar']);

/** Şehir adından IATA şehir kodu arar (Travelpayouts/Aviasales ücretsiz arama; yalnızca yazılan metin gönderilir). */
export async function searchCities(term: string, language: string, signal?: AbortSignal): Promise<PlaceHit[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const url = `${AUTOCOMPLETE}?term=${encodeURIComponent(q)}&locale=${LOCALES.has(language) ? language : 'en'}&types[]=city`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const rows = (await res.json()) as { type?: string; code?: string; name?: string; country_name?: string }[];
  return rows
    .filter((r) => r.type === 'city' && typeof r.code === 'string' && /^[A-Z]{3}$/.test(r.code) && typeof r.name === 'string')
    .slice(0, 6)
    .map((r) => ({ code: r.code!, name: r.name!.slice(0, 80), country: (r.country_name ?? '').slice(0, 60) }));
}
