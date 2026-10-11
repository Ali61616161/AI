import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type OfflineFile = { documentId: string; title: string; mimeType: string; uri: string };
export type OfflineTrip = { downloadedAt: string; files: OfflineFile[] };

type OfflineState = {
  trips: Record<string, OfflineTrip>;
  setTrip: (tripId: string, trip: OfflineTrip) => void;
  removeTrip: (tripId: string) => void;
  clear: () => void;
};

/** Çevrimdışı kullanım için indirilen seyahatler ve belge dosyalarının yerleri. */
export const useOfflineStore = create<OfflineState>()(
  persist(
    (set) => ({
      trips: {},
      setTrip: (tripId, trip) => set((s) => ({ trips: { ...s.trips, [tripId]: trip } })),
      removeTrip: (tripId) =>
        set((s) => {
          const { [tripId]: _removed, ...rest } = s.trips;
          return { trips: rest };
        }),
      clear: () => set({ trips: {} }),
    }),
    { name: 'yola-offline', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
