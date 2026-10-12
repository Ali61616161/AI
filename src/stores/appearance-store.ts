import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** Görünüm tercihi. Varsayılan koyu tema: uygulamanın ana kimliği. */
export type Appearance = 'dark' | 'light' | 'system';

type AppearanceState = {
  appearance: Appearance;
  setAppearance: (appearance: Appearance) => void;
};

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set) => ({
      appearance: 'dark',
      setAppearance: (appearance) => set({ appearance }),
    }),
    { name: 'yola.appearance', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
