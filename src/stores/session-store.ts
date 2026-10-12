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

/** Vatandaşlık, ek vizeler ve yaşanan şehir (pasaport gücü, Çark ve Şehrim için). */
export type TravelIdentity = {
  passport: string | null;
  otherPassports: string[];
  extraVisas: string[];
  homeCity: string | null;
  homeCountry: string | null;
  homeLat: number | null;
  homeLng: number | null;
};

/** Kayıt ekranında onaylanan sözleşme sürümü; giriş tamamlanınca hesaba yazılır. */
export type PendingConsents = { version: string; marketing: boolean };

type SessionState = {
  /** Supabase oturumu. Kalıcı saklanmaz; Supabase kendi oturumunu ayrıca saklar. */
  session: Session | null;
  /** Hesap açmadan devam eden kullanıcı. Veriler sadece bu telefonda kalır. */
  isGuest: boolean;
  preferences: TravelPreferences;
  identity: TravelIdentity;
  onboardingCompleted: boolean;
  /** Tanıtım slaytları bir kez gösterilir (çıkış yapınca sıfırlanmaz). */
  introSeen: boolean;
  consents: PendingConsents | null;

  setSession: (session: Session | null) => void;
  continueAsGuest: () => void;
  setPreferences: (patch: Partial<TravelPreferences>) => void;
  setIdentity: (patch: Partial<TravelIdentity>) => void;
  setIntroSeen: () => void;
  setConsents: (consents: PendingConsents | null) => void;
  completeOnboarding: () => void;
  signOut: () => void;
};

const emptyPreferences: TravelPreferences = { companion: null, budget: null, interests: [] };
export const emptyIdentity: TravelIdentity = { passport: null, otherPassports: [], extraVisas: [], homeCity: null, homeCountry: null, homeLat: null, homeLng: null };

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      session: null,
      isGuest: false,
      preferences: emptyPreferences,
      identity: emptyIdentity,
      onboardingCompleted: false,
      introSeen: false,
      consents: null,

      setSession: (session) => set((state) => ({ session, isGuest: session ? false : state.isGuest })),
      continueAsGuest: () => set({ isGuest: true }),
      setPreferences: (patch) => set((state) => ({ preferences: { ...state.preferences, ...patch } })),
      setIdentity: (patch) => set((state) => ({ identity: { ...state.identity, ...patch } })),
      setIntroSeen: () => set({ introSeen: true }),
      setConsents: (consents) => set({ consents }),
      completeOnboarding: () => set({ onboardingCompleted: true }),
      signOut: () =>
        set({ session: null, isGuest: false, preferences: emptyPreferences, identity: emptyIdentity, onboardingCompleted: false }),
    }),
    {
      name: 'yola.session',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isGuest: state.isGuest,
        preferences: state.preferences,
        identity: state.identity,
        onboardingCompleted: state.onboardingCompleted,
        introSeen: state.introSeen,
        consents: state.consents,
      }),
      // Eski kayıtlarda olmayan alanlar varsayılanla tamamlanır.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<SessionState>;
        return { ...current, ...p, identity: { ...emptyIdentity, ...p.identity } };
      },
    },
  ),
);

export const useIsSignedIn = () => useSessionStore((s) => s.session !== null || s.isGuest);
