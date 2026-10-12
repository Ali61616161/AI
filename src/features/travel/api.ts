import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { scheduleDocumentReminders } from './reminders';

// ---------------------------------------------------------------------------
// Gezdiğim ülkeler
// ---------------------------------------------------------------------------

/** Telefondaki listeyi hesaba yazar: eksikler eklenir, çıkarılanlar silinir. */
export async function pushVisited(codes: string[]): Promise<void> {
  if (!isSupabaseConfigured() || !useSessionStore.getState().session) return;
  const { data, error } = await getSupabase().from('visited_countries').select('country_code');
  if (error) throw error;
  const server = new Set((data ?? []).map((r) => r.country_code));
  const local = new Set(codes);
  const add = codes.filter((c) => !server.has(c)).map((country_code) => ({ country_code, source: 'self' }));
  const remove = [...server].filter((c) => !local.has(c));
  if (add.length) {
    const { error: e } = await getSupabase().from('visited_countries').upsert(add, { onConflict: 'user_id,country_code', ignoreDuplicates: true });
    if (e) throw e;
  }
  if (remove.length) {
    const { error: e } = await getSupabase().from('visited_countries').delete().in('country_code', remove);
    if (e) throw e;
  }
}

/** Girişte: sunucuda liste varsa telefona alınır, yoksa telefondaki (misafirken girilen) yazılır. */
export async function syncVisitedOnSignIn(): Promise<void> {
  const store = useSessionStore.getState();
  const { data, error } = await getSupabase().from('visited_countries').select('country_code');
  if (error) throw error;
  if (data?.length) store.setVisitedCountries([...new Set([...data.map((r) => r.country_code), ...store.visitedCountries])]);
  if (store.visitedCountries.length) await pushVisited(useSessionStore.getState().visitedCountries);
}

/** Biten Yola seyahatlerinin ülkeleri otomatik "gezildi" sayılır. */
export async function addCountriesFromTrips(): Promise<string[]> {
  if (!isSupabaseConfigured() || !useSessionStore.getState().session) return [];
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await getSupabase().from('trips').select('end_date, trip_destinations(country_code, city)').lt('end_date', today);
  const codes = new Set<string>();
  for (const t of data ?? []) for (const d of t.trip_destinations ?? []) if (d.country_code) codes.add(d.country_code);
  if (codes.size) {
    await getSupabase()
      .from('visited_countries')
      .upsert([...codes].map((country_code) => ({ country_code, source: 'trip' })), { onConflict: 'user_id,country_code', ignoreDuplicates: true });
    const store = useSessionStore.getState();
    store.setVisitedCountries([...store.visitedCountries, ...codes]);
  }
  return [...codes];
}

/** Yola seyahatlerinden gezilen şehir sayısı. */
export function useVisitedCities() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['visited-cities', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await getSupabase().from('trips').select('trip_destinations(city)').lt('start_date', today);
      if (error) throw error;
      return new Set((data ?? []).flatMap((t) => (t.trip_destinations ?? []).map((d) => d.city.trim().toLowerCase()))).size;
    },
  });
}

export function useVisitedPercentile() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['visited-percentile', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    staleTime: 60 * 60_000,
    queryFn: async () => {
      const { data } = await getSupabase().rpc('visited_percentile');
      return (data as number | null) ?? null;
    },
  });
}

// ---------------------------------------------------------------------------
// Belgeler ve Schengen kalışları
// ---------------------------------------------------------------------------

export type DocKind = 'passport' | 'visa' | 'residence' | 'id_card' | 'other';
export type TravelDocument = { id: string; kind: DocKind; country_code: string | null; label: string | null; expires_on: string };
export type SchengenStay = { id: string; entry_on: string; exit_on: string; note: string | null };

function useUserId() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

export function useDocuments() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['travel-docs', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('travel_documents').select('id, kind, country_code, label, expires_on').order('expires_on');
      if (error) throw error;
      const docs = data as TravelDocument[];
      // Hatırlatmalar her listede yeniden kurulur (telefon değişse de doğru kalır).
      scheduleDocumentReminders(docs).catch(() => undefined);
      return docs;
    },
  });
}

export function useSaveDocument() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (doc: Omit<TravelDocument, 'id'> & { id?: string }) => {
      const { error } = doc.id ? await getSupabase().from('travel_documents').update(doc).eq('id', doc.id) : await getSupabase().from('travel_documents').insert(doc);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['travel-docs', userId] }),
  });
}

export function useDeleteDocument() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('travel_documents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['travel-docs', userId] }),
  });
}

export function useSchengenStays() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['schengen-stays', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const { data, error } = await getSupabase().from('schengen_stays').select('id, entry_on, exit_on, note').order('entry_on', { ascending: false });
      if (error) throw error;
      return data as SchengenStay[];
    },
  });
}

export function useSaveStay() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (stay: Omit<SchengenStay, 'id'>) => {
      const { error } = await getSupabase().from('schengen_stays').insert(stay);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schengen-stays', userId] }),
  });
}

export function useDeleteStay() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from('schengen_stays').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['schengen-stays', userId] }),
  });
}

/** Belge uyarı seviyesi: pasaport için 6 ay (çoğu ülkenin giriş şartı), vize/oturum için 30 gün. */
export function documentWarning(doc: Pick<TravelDocument, 'kind' | 'expires_on'>, today = new Date()): 'expired' | 'soon' | null {
  const days = Math.floor((Date.parse(`${doc.expires_on}T00:00:00Z`) - Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) / 86_400_000);
  if (days < 0) return 'expired';
  if (days <= (doc.kind === 'passport' || doc.kind === 'id_card' ? 183 : 30)) return 'soon';
  return null;
}
