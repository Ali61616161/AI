import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import { clearOfflineData } from '@/features/offline/download';
import { useLiveStore } from '@/features/live/live-store';
import { useSessionStore } from '@/stores/session-store';

/** Çıkış, hesap silme ya da başka hesaba geçişte telefondaki tüm kişisel kayıtları, planlı bildirimleri ve canlı işaretleri siler. */
export async function resetLocalUserData(): Promise<void> {
  clearOfflineData();
  useSessionStore.getState().signOut();
  useLiveStore.setState({ marks: {}, freeDays: {} });
  await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
  const keys = await AsyncStorage.getAllKeys().catch(() => [] as readonly string[]);
  const mine = keys.filter((k) => k.startsWith('yola.liveNudges.'));
  if (mine.length) await AsyncStorage.multiRemove(mine).catch(() => undefined);
}
