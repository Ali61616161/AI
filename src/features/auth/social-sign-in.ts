import type { Session } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { currentLanguage } from '@/i18n';
import { getSupabase } from '@/lib/supabase';

/** Uygulamaya dönüş adresi; Supabase "Redirect URLs" listesinde kayıtlı olmalı. */
export const AUTH_REDIRECT = 'yola://auth-callback';

export type SocialResult = { session: Session } | { cancelled: true } | { error: string };

/** Apple ile giriş sadece iOS'ta (cihazın kendi penceresiyle) gösterilir. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  return AppleAuthentication.isAvailableAsync().catch(() => false);
}

/**
 * Apple ile giriş: cihazın kimlik belirteci Supabase'e verilir. Tekrar oynatmaya karşı
 * rastgele bir "nonce" üretilir; Apple'a özeti, Supabase'e kendisi gönderilir.
 */
export async function signInWithApple(): Promise<SocialResult> {
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      nonce: hashedNonce,
    });
    if (!credential.identityToken) return { error: 'no_token' };
    const { data, error } = await getSupabase().auth.signInWithIdToken({ provider: 'apple', token: credential.identityToken, nonce: rawNonce });
    if (error || !data.session) return { error: error?.message ?? 'no_session' };
    // Apple adı sadece ilk girişte verir; profilde ad yoksa kaydedilir.
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    if (name) await getSupabase().auth.updateUser({ data: { full_name: name, language: currentLanguage() } }).catch(() => undefined);
    return { session: data.session };
  } catch (e) {
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') return { cancelled: true };
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;

/** Cihazın kendi Google penceresi: iOS'ta iOS + web, Android'de web istemci kimliği gerekir. */
export const nativeGoogleAvailable = Platform.OS === 'ios' ? Boolean(googleWebClientId && googleIosClientId) : Platform.OS === 'android' ? Boolean(googleWebClientId) : false;

/**
 * Google ile giriş (cihaz penceresi): Google kimlik belirteci doğrudan Supabase'e verilir. Ekranda
 * "supabase.co ile giriş" uyarısı çıkmaz; Google kendi hesap seçicisini gösterir.
 */
async function signInWithGoogleNative(): Promise<SocialResult> {
  try {
    // Yerel modül sadece gerektiğinde yüklenir (web önizlemesinde ve anahtarsız derlemede yok).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = require('@react-native-google-signin/google-signin') as typeof import('@react-native-google-signin/google-signin');
    GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices();
    try {
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response) || !response.data.idToken) return { cancelled: true };
      const { data, error } = await getSupabase().auth.signInWithIdToken({ provider: 'google', token: response.data.idToken });
      if (error || !data.session) return { error: error?.message ?? 'no_session' };
      return { session: data.session };
    } catch (e) {
      if (isErrorWithCode(e) && e.code === statusCodes.SIGN_IN_CANCELLED) return { cancelled: true };
      throw e;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Google ile giriş: cihaz penceresi varsa o, yoksa Supabase'in Google sayfası uygulama içi tarayıcıda açılır, dönüşte
 * gelen tek kullanımlık kod oturuma çevrilir (PKCE).
 */
export async function signInWithGoogle(): Promise<SocialResult> {
  if (nativeGoogleAvailable) return signInWithGoogleNative();
  const { data, error } = await getSupabase().auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: AUTH_REDIRECT, skipBrowserRedirect: true, queryParams: { prompt: 'select_account' } },
  });
  if (error || !data.url) return { error: error?.message ?? 'no_url' };
  const result = await WebBrowser.openAuthSessionAsync(data.url, AUTH_REDIRECT);
  if (result.type !== 'success') return { cancelled: true };
  const url = new URL(result.url);
  const code = url.searchParams.get('code');
  const failure = url.searchParams.get('error_description') ?? url.searchParams.get('error');
  if (!code) return failure ? { error: failure } : { cancelled: true };
  const exchanged = await getSupabase().auth.exchangeCodeForSession(code);
  if (exchanged.error || !exchanged.data.session) return { error: exchanged.error?.message ?? 'no_session' };
  return { session: exchanged.data.session };
}
