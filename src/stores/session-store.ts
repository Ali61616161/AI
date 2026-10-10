import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { BudgetTier, Companion } from '@/features/profile/options';

export type TravelPreferences = {
  companion: Companion | null;
  budget: BudgetTier | null;
  interests: string[];
};

type SessionState = {
  /** Supabase oturumu. Kalıcı saklanmaz; Supabase kendi oturumunu ayrıca saklar. */
  session: Session | null;
  /** Hesap açmadan devam eden kullanıcı. Veriler sadece bu telefonda kalır. */
  isGuest: boolean;
  preferences: TravelPreferences;
  onboardingCompleted: boolean;

  setSession: (session: Session | null) => void;
  continueAsGuest: () => void;
  setPreferences: (patch: Partial<TravelPreferences>) => void;
  completeOnboarding: () => void;
  signOut: () => void;
};

const emptyPreferences: TravelPreferences = { companion: null, budget: null, interests: [] };

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      isGuest: false,
      preferences: emptyPreferences,
      onboardingCompleted: false,

      setSession: (session) => set((state) => ({ session, isGuest: session ? false : state.isGuest })),
      continueAsGuest: () => set({ isGuest: true }),
      setPreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      signOut: () =>
        set({ session: null, isGuest: false, preferences: emptyPreferences, onboardingCompleted: false }),
    }),
    {
      name: 'yola.session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isGuest: state.isGuest,
        preferences: state.preferences,
        onboardingCompleted: state.onboardingCompleted,
      }),
    },
  ),
);

export const useIsSignedIn = () => useSessionStore((s) => s.session !== null || s.isGuest);
