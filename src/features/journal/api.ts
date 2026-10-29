import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { isEmptyEntry, isMood, photoPath, type JournalEntry, type JournalMood } from './logic';

const SIGNED_URL_SECONDS = 3600;

function useUserId() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

export function useJournal(tripId: string | undefined) {
  const userId = useUserId();
  return useQuery({
    queryKey: ['journal', tripId, userId],
    enabled: Boolean(userId && tripId) && isSupabaseConfigured(),
    queryFn: async (): Promise<JournalEntry[]> => {
      const { data, error } = await getSupabase()
        .from('journal_entries')
        .select('id, trip_id, entry_date, note, mood, photos, places')
        .eq('trip_id', tripId!)
        .eq('user_id', userId!)
        .order('entry_date', { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({ ...r, mood: isMood(r.mood) ? r.mood : null }));
    },
  });
}

/** Özel kovadaki fotoğraflar için geçici (1 saatlik) görüntüleme bağlantıları: yol → adres. */
export function usePhotoUrls(paths: string[]) {
  const key = [...paths].sort().join('|');
  return useQuery({
    queryKey: ['journal-photos', key],
    enabled: paths.length > 0 && isSupabaseConfigured(),
    staleTime: (SIGNED_URL_SECONDS / 2) * 1000,
    queryFn: async () => {
      const { data, error } = await getSupabase().storage.from('journal').createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (error) throw error;
      return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
    },
  });
}

/** Fotoğrafı küçültüp JPEG olarak kullanıcının günlük klasörüne yükler; kovadaki yolu döndürür. */
export async function uploadJournalPhoto(uri: string, userId: string, tripId: string): Promise<string> {
  const image = await ImageManipulator.manipulate(uri).resize({ width: 1600 }).renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  const bytes = Platform.OS === 'web' ? await (await fetch(saved.uri)).arrayBuffer() : await new File(saved.uri).arrayBuffer();
  const path = photoPath(userId, tripId, Crypto.randomUUID());
  const { error } = await getSupabase().storage.from('journal').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return path;
}

export type SaveEntryInput = { tripId: string; date: string; note: string; mood: JournalMood | null; photos: string[]; places: string[]; previousPhotos?: string[] };

/** O günün kaydını yazar; her şey boşaltılmışsa kaydı siler. Kaydından çıkarılan fotoğraflar kovadan da silinir. */
export function useSaveJournalEntry() {
  const queryClient = useQueryClient();
  const userId = useUserId();
  return useMutation({
    mutationFn: async (input: SaveEntryInput) => {
      const supabase = getSupabase();
      const note = input.note.trim();
      if (isEmptyEntry({ note, mood: input.mood, photos: input.photos, places: input.places })) {
        const { error } = await supabase.from('journal_entries').delete().eq('trip_id', input.tripId).eq('user_id', userId!).eq('entry_date', input.date);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('journal_entries')
          .upsert({ trip_id: input.tripId, user_id: userId!, entry_date: input.date, note, mood: input.mood, photos: input.photos, places: input.places }, { onConflict: 'trip_id,user_id,entry_date' });
        if (error) throw error;
      }
      const removed = (input.previousPhotos ?? []).filter((p) => !input.photos.includes(p));
      if (removed.length > 0) await supabase.storage.from('journal').remove(removed);
    },
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: ['journal', input.tripId, userId] });
    },
  });
}
