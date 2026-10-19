import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StopMark } from './drift-logic';

type LiveState = {
  /** Durak kimliği → kullanıcının işareti ("gittim" / "atla"). */
  marks: Record<string, StopMark>;
  /** "seyahat|tarih" → o gün serbest: plan görünür kalır ama sorulmaz ve bildirim gelmez. */
  freeDays: Record<string, true>;
  mark: (stopId: string, mark: StopMark | null) => void;
  setFreeDay: (key: string, free: boolean) => void;
};

/** Canlı seyahatte plana uyma işaretleri ve serbest günler (telefonda saklanır). */
export const useLiveStore = create<LiveState>()(
  persist(
    (set) => ({
      marks: {},
      freeDays: {},
      mark: (stopId, mark) =>
        set((s) => {
          const marks = { ...s.marks };
          if (mark) marks[stopId] = mark;
          else delete marks[stopId];
          return { marks };
        }),
      setFreeDay: (key, free) =>
        set((s) => {
          const freeDays = { ...s.freeDays };
          if (free) freeDays[key] = true;
          else delete freeDays[key];
          return { freeDays };
        }),
    }),
    { name: 'yola-live', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
