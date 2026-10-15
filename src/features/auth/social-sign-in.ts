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

/**
 * Google ile giriş: Supabase'in Google sayfası uygulama içi tarayıcıda açılır, dönüşte
 * gelen tek kullanımlık kod oturuma çevrilir (PKCE).
 */
export async function signInWithGoogle(): Promise<SocialResult> {
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
