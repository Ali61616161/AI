import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/**
 * Supabase istemcisini ilk kullanımda oluşturur. Ortam değişkenleri eksikse
 * uygulama açılışta çökmez; yalnızca Supabase gerçekten kullanıldığında net bir hata verir.
 *
 * Not: Uygulamaya sadece "publishable" anahtar konur. AI ve Places API anahtarları
 * asla burada değil, Supabase Edge Functions içinde tutulur.
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  if (!url || !publishableKey) {
    throw new Error(
      'Supabase ayarları eksik: .env.local dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ekleyin.',
    );
  }

  client = createClient(url, publishableKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });

  // Oturum yenileme sadece uygulama ön plandayken çalışsın.
  if (Platform.OS !== 'web') {
    AppState.addEventListener('change', (state) => {
      if (state === 'active') client?.auth.startAutoRefresh();
      else client?.auth.stopAutoRefresh();
    });
  }

  return client;
}
