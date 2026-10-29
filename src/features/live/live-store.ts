import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { StopMark } from './drift-logic';
import type { StepValue } from './live-flow';

type DayFlag = 'started' | 'ended';

type LiveState = {
  /** Durak kimliği → kullanıcının işareti ("gittim" / "atla"). */
  marks: Record<string, StopMark>;
  /** Durak kimliği → ara adım: "yoldayım" ya da "buradayım". İşaret konunca silinir. */
  steps: Record<string, StepValue>;
  /** "seyahat|tarih" → o gün serbest: plan görünür kalır ama sorulmaz ve bildirim gelmez. */
  freeDays: Record<string, true>;
  /** "seyahat|tarih" → günü başlattın ya da bitirdin. */
  dayFlags: Record<string, DayFlag>;
  mark: (stopId: string, mark: StopMark | null) => void;
  /** Birçok durağı tek seferde işaretler (gün sonunda kalanları atlamak için). */
  markMany: (stopIds: string[], mark: StopMark) => void;
  setStep: (stopId: string, step: StepValue | null) => void;
  setFreeDay: (key: string, free: boolean) => void;
  setDayFlag: (key: string, flag: DayFlag | null) => void;
};

/** Canlı seyahatte plana uyma işaretleri, ara adımlar, günün başlayıp bitmesi ve serbest günler (telefonda saklanır). */
export const useLiveStore = create<LiveState>()(
  persist(
    (set) => ({
      marks: {},
      steps: {},
      freeDays: {},
      dayFlags: {},
      mark: (stopId, mark) =>
        set((s) => {
          const marks = { ...s.marks };
          const steps = { ...s.steps };
          if (mark) {
            marks[stopId] = mark;
            delete steps[stopId];
          } else delete marks[stopId];
          return { marks, steps };
        }),
      markMany: (stopIds, mark) =>
        set((s) => {
          const marks = { ...s.marks };
          const steps = { ...s.steps };
          for (const id of stopIds) {
            marks[id] = mark;
            delete steps[id];
          }
          return { marks, steps };
        }),
      setStep: (stopId, step) =>
        set((s) => {
          const steps = { ...s.steps };
          if (step) steps[stopId] = step;
          else delete steps[stopId];
          return { steps };
        }),
      setFreeDay: (key, free) =>
        set((s) => {
          const freeDays = { ...s.freeDays };
          if (free) freeDays[key] = true;
          else delete freeDays[key];
          return { freeDays };
        }),
      setDayFlag: (key, flag) =>
        set((s) => {
          const dayFlags = { ...s.dayFlags };
          if (flag) dayFlags[key] = flag;
          else delete dayFlags[key];
          return { dayFlags };
        }),
    }),
    { name: 'yola-live', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
