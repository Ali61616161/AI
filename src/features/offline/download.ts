import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

import { queryClient } from '@/lib/query-client';
import { getSupabase } from '@/lib/supabase';

import { useOfflineStore, type OfflineFile } from './offline-store';

const SIGNED_URL_SECONDS = 600;

function tripDir(tripId: string) {
  return new Directory(Paths.document, 'offline', tripId);
}

/** Web'de dosya indirilemez; sadece veriler tarayıcı belleğinde kalır. */
export const canDownloadFiles = Platform.OS !== 'web';

/**
 * Seyahati çevrimdışı kullanıma hazırlar: seyahat, aktif plan ve hava tahmini
 * sorguları yenilenip telefona kaydedilir; rezervasyon belgeleri (bilet, otel
 * onayı) uygulama klasörüne indirilir.
 */
export async function downloadTripForOffline(tripId: string, onProgress?: (done: number, total: number) => void): Promise<number> {
  await Promise.all(
    [['trip', tripId], ['plan', tripId], ['weather', tripId]].map((queryKey) => queryClient.refetchQueries({ queryKey, type: 'all' })),
  );

  const files: OfflineFile[] = [];
  if (canDownloadFiles) {
    const supabase = getSupabase();
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select('title, document_id, documents(id, storage_path, mime_type)')
      .eq('trip_id', tripId)
      .not('document_id', 'is', null);
    if (error) throw error;

    const docs = new Map<string, { title: string; path: string; mime: string }>();
    for (const r of reservations ?? []) {
      const d = r.documents as unknown as { id: string; storage_path: string; mime_type: string } | null;
      if (d && !docs.has(d.id)) docs.set(d.id, { title: r.title, path: d.storage_path, mime: d.mime_type });
    }

    const dir = tripDir(tripId);
    if (!dir.exists) dir.create({ intermediates: true });
    let done = 0;
    onProgress?.(done, docs.size);
    for (const [id, doc] of docs) {
      const { data: signed, error: signError } = await supabase.storage.from('documents').createSignedUrl(doc.path, SIGNED_URL_SECONDS);
      if (signError || !signed) throw signError ?? new Error('signed url failed');
      const extension = doc.path.split('.').pop() ?? 'bin';
      const target = new File(dir, `${id}.${extension}`);
      if (target.exists) target.delete();
      const file = await File.downloadFileAsync(signed.signedUrl, target);
      files.push({ documentId: id, title: doc.title, mimeType: doc.mime, uri: file.uri });
      onProgress?.(++done, docs.size);
    }
  }

  useOfflineStore.getState().setTrip(tripId, { downloadedAt: new Date().toISOString(), files });
  return files.length;
}

export function removeOfflineTrip(tripId: string) {
  if (canDownloadFiles) {
    const dir = tripDir(tripId);
    if (dir.exists) dir.delete();
  }
  useOfflineStore.getState().removeTrip(tripId);
}

/** Çıkış yapılınca telefondaki tüm kişisel kayıtlar silinir. */
export function clearOfflineData() {
  queryClient.clear();
  if (canDownloadFiles) {
    const dir = new Directory(Paths.document, 'offline');
    if (dir.exists) dir.delete();
  }
  useOfflineStore.getState().clear();
}
