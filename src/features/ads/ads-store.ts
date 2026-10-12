import { create } from 'zustand';

/** Reklam SDK'sı izinler alınıp başlatıldı mı (sadece bu oturum için). */
export const useAdsStore = create<{ ready: boolean; setReady: (ready: boolean) => void }>()((set) => ({
  ready: false,
  setReady: (ready) => set({ ready }),
}));
