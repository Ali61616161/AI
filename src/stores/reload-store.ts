import { create } from 'zustand';

/**
 * Uygulama içi "yeniden yükleme": sayı artınca kök ekranlar sıfırdan kurulur (açık ekranlar, sohbetler ve
 * bellekteki durum temizlenir). Dil değişince kullanılır; telefonu kapatıp açmaktan farkı yoktur ama iOS
 * uygulamanın kendini kapatmasına izin vermediği için bu yol seçildi.
 */
type ReloadState = { nonce: number; reload: () => void };

export const useReloadStore = create<ReloadState>((set) => ({
  nonce: 0,
  reload: () => set((s) => ({ nonce: s.nonce + 1 })),
}));
