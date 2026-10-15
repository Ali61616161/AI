import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '@/types/database';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient<Database> | null = null;

/** Ortam değişkenleri girilmemişse uygulama "misafir modunda" çalışır. */
export function isSupabaseConfigured(): boolean {
  return Boolean(url && publishableKey);
}

/**
 * Supabase istemcisini ilk kullanımda oluşturur. Ortam değişkenleri eksikse
 * uygulama açılışta çökmez; yalnızca Supabase gerçekten kullanıldığında net bir hata verir.
 *
 * Not: Uygulamaya sadece "publishable" anahtar konur. AI ve Places API anahtarları
 * asla burada değil, Supabase Edge Functions içinde tutulur.
 */
export function getSupabase(): SupabaseClient<Database> {
  if (client) return client;
  if (!url || !publishableKey) {
    throw new Error(
      'Supabase ayarları eksik: .env.local dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ekleyin.',
    );
  }

  client = createClient<Database>(url, publishableKey, {
    auth: {
      storage: Platform.OS === 'web' ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // Google ile girişte dönüş kodu oturuma çevrilir (PKCE); e-posta koduyla girişi etkilemez.
      flowType: 'pkce',
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
