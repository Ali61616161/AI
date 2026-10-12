import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { EveningPlan, GetawaysResponse } from '@/features/city/api';

/**
 * Son Şehrim sonuçları telefonda saklanır: ekrana dönünce plan yeniden istenmez
 * (ücretsiz hak haftada bir) ve internet yokken de görülebilir.
 */
type CityState = {
  evening: (EveningPlan & { createdAt: string; when: string }) | null;
  getaways: (GetawaysResponse & { createdAt: string }) | null;
  setEvening: (plan: CityState['evening']) => void;
  setGetaways: (result: CityState['getaways']) => void;
  clear: () => void;
};

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      evening: null,
      getaways: null,
      setEvening: (evening) => set({ evening }),
      setGetaways: (getaways) => set({ getaways }),
      clear: () => set({ evening: null, getaways: null }),
    }),
    { name: 'yola.city', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
