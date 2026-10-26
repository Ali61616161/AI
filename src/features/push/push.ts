import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

const TOKEN_KEY = 'yola.pushToken';

/**
 * Anlık bildirim (push) yalnızca derleme push yetkisiyle yapıldığında (ENABLE_PUSH=1) açılır. Yetkisiz derlemede
 * token alınamaz; bu yüzden hiç denenmez ve uygulama yalnızca yerel bildirimlerle çalışır.
 */
export const pushEnabled = (Constants.expoConfig?.extra as { pushEnabled?: boolean } | undefined)?.pushEnabled === true;

/** Bildirim izni verilmişse cihazın Expo push token'ını alıp bu hesaba bağlar (sunucu uçuş uyarıları için). */
export async function registerPushToken(): Promise<void> {
  if (!pushEnabled || !isSupabaseConfigured() || Platform.OS === 'web') return;
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const projectId = (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId;
  if (!projectId) return;
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  if (!token) return;
  const { error } = await getSupabase().rpc('register_push_token', { p_token: token, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  if (!error) await AsyncStorage.setItem(TOKEN_KEY, token);
}

/** Çıkışta bu cihazın kaydını siler (oturum hâlâ geçerliyken çağrılmalı) ki başkası bildirim almasın. */
export async function unregisterPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY).catch(() => null);
  if (!token) return;
  if (isSupabaseConfigured()) await Promise.resolve(getSupabase().rpc('unregister_push_token', { p_token: token })).catch(() => undefined);
  await AsyncStorage.removeItem(TOKEN_KEY).catch(() => undefined);
}

/** Oturum açıkken (ve açılışta) cihaz kaydını tazeler. Kök layout'ta bir kez çağrılır. */
export function usePushRegistration(): void {
  const signedIn = useSessionStore((s) => Boolean(s.session));
  useEffect(() => {
    if (signedIn) registerPushToken().catch(() => undefined);
  }, [signedIn]);
}
