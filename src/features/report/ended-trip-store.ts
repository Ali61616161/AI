import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/** "Seyahatin nasıldı?" penceresi gösterilen seyahatler; aynı seyahat için tekrar sorulmaz. */
type State = { seen: string[]; markSeen: (tripId: string) => void };

export const useEndedTripStore = create<State>()(
  persist(
    (set) => ({
      seen: [],
      markSeen: (tripId) => set((s) => (s.seen.includes(tripId) ? s : { seen: [...s.seen, tripId].slice(-50) })),
    }),
    { name: 'yola.ended-trip', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
