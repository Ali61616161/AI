import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { I18nextProvider } from 'react-i18next';

import { useAuthListener } from '@/features/auth/use-auth-listener';
import i18n, { initI18n } from '@/i18n';
import { useIsSignedIn, useSessionStore } from '@/stores/session-store';
import { useTheme } from '@/theme/use-theme';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, retry: 1 },
  },
});

/** Telefonda kayıtlı oturum bilgisi okunana kadar bekler. */
function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState(() => useSessionStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useSessionStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);
  return hydrated;
}

export default function RootLayout() {
  const [i18nReady, setI18nReady] = useState(false);
  const hydrated = useStoreHydrated();
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
      card: colors.surface,
      text: colors.text,
      border: colors.border,
    },
  };

  // Hangi ekran grubunun açık olacağını oturum ve onboarding durumu belirler.
  // Koşul değişince (ör. çıkış yapınca) Expo Router uygun gruba kendisi yönlendirir.
  return (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={navigationTheme}>
          <Stack screenOptions={{ headerShown: false }}>
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
      </QueryClientProvider>
    </I18nextProvider>
  );
}
