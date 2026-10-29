import AsyncStorage from '@react-native-async-storage/async-storage';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import Constants from 'expo-constants';
import * as Network from 'expo-network';

/** Kayıtlı veriler en fazla bu kadar süre saklanır (seyahat boyunca yeterli). */
const MAX_AGE = 21 * 24 * 60 * 60_000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: MAX_AGE,
      retry: 1,
      // Bağlantı yoksa önce telefondaki kayıt gösterilir; bağlantı gelince yenilenir.
      networkMode: 'offlineFirst',
    },
    mutations: { networkMode: 'online' },
  },
});

/** Çevrimdışı kullanım için telefonda saklanan sorgular. */
const PERSISTED_KEYS = new Set(['trips', 'trip', 'plan', 'weather', 'hotels', 'expenses', 'packing', 'trip-report', 'profile', 'plan-translation', 'text-translation']);

export const persistOptions = {
  persister: createAsyncStoragePersister({ storage: AsyncStorage, key: 'yola-query-cache', throttleTime: 2000 }),
  maxAge: MAX_AGE,
  // Uygulama sürümü değişince eski biçimdeki kayıtlar atılır.
  buster: Constants.expoConfig?.version ?? '1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query: { queryKey: readonly unknown[]; state: { status: string } }) =>
      query.state.status === 'success' && PERSISTED_KEYS.has(String(query.queryKey[0])),
  },
};

// TanStack Query'nin çevrimiçi durumunu telefonun ağ durumuna bağla.
onlineManager.setEventListener((setOnline) => {
  const subscription = Network.addNetworkStateListener((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false));
  Network.getNetworkStateAsync()
    .then((state) => setOnline(state.isConnected !== false && state.isInternetReachable !== false))
    .catch(() => undefined);
  return () => subscription.remove();
});
