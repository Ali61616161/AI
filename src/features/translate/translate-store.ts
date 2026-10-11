import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type TranslateState = {
  myLanguage: string | null;
  theirLanguage: string | null;
  setLanguages: (mine: string, theirs: string) => void;
};

/** Çeviri merkezinde son seçilen diller. */
export const useTranslateStore = create<TranslateState>()(
  persist(
    (set) => ({
      myLanguage: null,
      theirLanguage: null,
      setLanguages: (myLanguage, theirLanguage) => set({ myLanguage, theirLanguage }),
    }),
    { name: 'yola-translate', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
