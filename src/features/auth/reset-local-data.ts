import { unregisterPushToken } from '@/features/push/push';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, Paths } from 'expo-file-system';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { useLiveStore } from '@/features/live/live-store';
import { clearOfflineData } from '@/features/offline/download';
import { useEndedTripStore } from '@/features/report/ended-trip-store';
import { identifyPurchaser } from '@/features/subscription/purchases';
import { useContactsStore } from '@/features/tools/contacts-store';
import { persistOptions, queryClient } from '@/lib/query-client';
import { clearSecureSession } from '@/lib/secure-session-storage';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

/** Seçilen bilet/fotoğrafların kopyaları (belge seçici, kamera) ve okunan çeviri cümlelerinin ses dosyaları. */
const PICKER_CACHE_DIRS = ['DocumentPicker', 'ImagePicker', 'Camera', 'tts'];

/**
 * Çıkış, hesap silme ya da başka hesaba geçişte telefondaki tüm kişisel kayıtları siler: oturum
 * anahtarları, çevrimdışı biletler, sorgu önbelleği, acil durum kişileri, planlı bildirimler,
 * canlı işaretler, seçilen dosyaların geçici kopyaları ve satın alma eşlemesi.
 *
 * `signOut: false` yalnızca Supabase zaten "çıkış yapıldı" bildirdiğinde kullanılır (döngü olmasın).
 */
export async function resetLocalUserData({ signOut = true }: { signOut?: boolean } = {}): Promise<void> {
  // Oturum hâlâ geçerliyken bu cihazın bildirim kaydı silinir (çıkıştan sonra başkası bildirim almasın).
  await unregisterPushToken().catch(() => undefined);
  if (signOut && isSupabaseConfigured()) {
    // İnternet yokken de oturum telefonda kalmasın: yerel çıkış + anahtarların elle silinmesi (aşağıda).
    await getSupabase().auth.signOut({ scope: 'local' }).catch(() => undefined);
  }
  if (isSupabaseConfigured()) await getSupabase().auth.stopAutoRefresh().catch(() => undefined);

  // Süren istekler (ör. seyahat listesi) temizlikten sonra eski verileri geri yazmasın.
  await Promise.resolve(queryClient.cancelQueries()).catch(() => undefined);
  clearOfflineData();
  await Promise.resolve(persistOptions.persister.removeClient()).catch(() => undefined);

  useSessionStore.getState().signOut();
  useLiveStore.setState({ marks: {}, freeDays: {} });
  useContactsStore.setState({ contacts: [] });
  useEndedTripStore.setState({ seen: [] });
  await identifyPurchaser(null);
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);

  await clearSecureSession();
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  // sb-…: Supabase oturumu ve PKCE doğrulayıcısı; yola.liveNudges.…: durak hatırlatmaları.
  const mine = keys.filter((k) => k.startsWith('sb-') || k.startsWith('yola.liveNudges.'));
  if (mine.length) await AsyncStorage.multiRemove(mine).catch(() => undefined);

  if (Platform.OS !== 'web') {
    for (const name of PICKER_CACHE_DIRS) {
      try {
        const dir = new Directory(Paths.cache, name);
        if (dir.exists) dir.delete();
      } catch {
        // geçici klasör yoksa ya da silinemezse işletim sistemi zamanla temizler
      }
    }
  }
}
