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
  /** Misafir kullanıcının çark hakkı telefonda sayılır (günde 1). */
  guestSpins: { date: string; count: number };
  takeGuestSpin: () => boolean;
  setEvening: (plan: CityState['evening']) => void;
  setGetaways: (result: CityState['getaways']) => void;
  clear: () => void;
};

export const useCityStore = create<CityState>()(
  persist(
    (set, get) => ({
      evening: null,
      getaways: null,
      guestSpins: { date: '', count: 0 },
      takeGuestSpin: () => {
        const today = new Date().toISOString().slice(0, 10);
        const cur = get().guestSpins;
        const count = cur.date === today ? cur.count : 0;
        if (count >= 1) return false;
        set({ guestSpins: { date: today, count: count + 1 } });
        return true;
      },
      setEvening: (evening) => set({ evening }),
      setGetaways: (getaways) => set({ getaways }),
      clear: () => set({ evening: null, getaways: null }),
    }),
    { name: 'yola.city', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
