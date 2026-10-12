import { Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { Unbounded_600SemiBold, Unbounded_700Bold } from '@expo-google-fonts/unbounded';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { useAuthListener } from '@/features/auth/use-auth-listener';
import { OfflineBanner } from '@/features/offline/offline-banner';
import i18n, { initI18n } from '@/i18n';
import { persistOptions, queryClient } from '@/lib/query-client';
import { useAppearanceStore } from '@/stores/appearance-store';
import { useIsSignedIn, useSessionStore } from '@/stores/session-store';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();


type PersistedStore = { persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void } };

/** Telefonda kayıtlı bilgi (oturum, görünüm) okunana kadar bekler. */
function useStoreHydrated(store: PersistedStore): boolean {
  const [hydrated, setHydrated] = useState(() => store.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return store.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated, store]);
  return hydrated;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const sessionHydrated = useStoreHydrated(useSessionStore);
  const appearanceHydrated = useStoreHydrated(useAppearanceStore);
  // Yazı tipleri yüklenemezse (ör. bozuk önbellek) sistem yazı tipiyle devam edilir.
  const [fontsLoaded, fontError] = useFonts({
    Unbounded_600SemiBold,
    Unbounded_700Bold,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const hydrated = sessionHydrated && appearanceHydrated && (fontsLoaded || !!fontError);
  const { colors, isDark } = useTheme();
  const signedIn = useIsSignedIn();
  const onboarded = useSessionStore((s) => s.onboardingCompleted);
  useAuthListener();

  useEffect(() => {
    initI18n()
      .catch((error) => console.warn('i18n başlatılamadı', error))
      .finally(() => setI18nReady(true));
  }, []);

  const ready = i18nReady && hydrated;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  const base = isDark ? DarkTheme : DefaultTheme;
  const navigationTheme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.backgroundElevated,
      text: colors.text,
      border: colors.border,
    },
  };

  // Hangi ekran grubunun açık olacağını oturum ve onboarding durumu belirler.
  // Koşul değişince (ör. çıkış yapınca) Expo Router uygun gruba kendisi yönlendirir.
  return (
    <I18nextProvider i18n={i18n}>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ThemeProvider value={navigationTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background }, animation: 'fade_from_bottom' }}>
            <Stack.Protected guard={!signedIn}>
              <Stack.Screen name="(auth)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && !onboarded}>
              <Stack.Screen name="(onboarding)" />
            </Stack.Protected>
            <Stack.Protected guard={signedIn && onboarded}>
              <Stack.Screen name="(app)" />
            </Stack.Protected>
            {/* Misafir kullanıcı uygulamanın içinden de hesap açabilsin diye korumasız. */}
            <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
            <Stack.Screen name="verify" options={{ presentation: 'modal' }} />
          </Stack>
        </ThemeProvider>
      </PersistQueryClientProvider>
    </I18nextProvider>
  );
}
