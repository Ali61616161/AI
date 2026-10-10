import { Redirect } from 'expo-router';

import { useIsSignedIn, useSessionStore } from '@/stores/session-store';

/**
 * Bilinmeyen bir adres açılırsa (ör. eski bir bağlantı) kullanıcının o an
 * girebileceği ilk ekrana yönlendirir. Korumalı bir ekrana yönlendirme sessizce
 * başarısız olacağı için hedef oturum durumuna göre seçilir.
 */
export default function NotFound() {
  const signedIn = useIsSignedIn();
  const onboarded = useSessionStore((s) => s.onboardingCompleted);
  const href = !signedIn ? '/welcome' : !onboarded ? '/companion' : '/';
  return <Redirect href={href} />;
}
