import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type PhraseCache = {
  /** Dil kodu → cümle anahtarı → çeviri. Bir kez indirilince internetsiz de çalışır. */
  translations: Record<string, Record<string, string>>;
  save: (language: string, texts: Record<string, string>) => void;
};

export const usePhraseCache = create<PhraseCache>()(
  persist(
    (set) => ({
      translations: {},
      save: (language, texts) => set((s) => ({ translations: { ...s.translations, [language]: texts } })),
    }),
    { name: 'yola-phrase-cache', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
