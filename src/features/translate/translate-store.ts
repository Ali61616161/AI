import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type TranslateState = {
  myLanguage: string | null;
  theirLanguage: string | null;
  /** Dil (konuşma kodu, ör. tr-TR) → seçilen ses kimliği. */
  voices: Record<string, string>;
  setLanguages: (mine: string, theirs: string) => void;
  setVoice: (speechTag: string, identifier: string) => void;
};

/** Çeviri merkezinde son seçilen diller ve sesler. */
export const useTranslateStore = create<TranslateState>()(
  persist(
    (set) => ({
      myLanguage: null,
      theirLanguage: null,
      voices: {},
      setLanguages: (myLanguage, theirLanguage) => set({ myLanguage, theirLanguage }),
      setVoice: (speechTag, identifier) => set((s) => ({ voices: { ...s.voices, [speechTag]: identifier } })),
    }),
    { name: 'yola-translate', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
