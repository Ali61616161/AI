import { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, MaxAdContentRating } from 'react-native-google-mobile-ads';

import { useAdsStore } from './ads-store';
import { useIsFreePlan } from './use-show-ads';

let started = false;

/**
 * Ücretsiz kullanıcı için reklam izinlerini sırayla alır ve SDK'yı başlatır:
 * 1) AB/İngiltere vb. için Google onay formu (UMP), 2) iOS'ta Apple takip izni,
 * 3) içerik derecesi ayarı ve başlatma. İzin verilmezse reklam yüklenmez.
 */
export function useAdsBootstrap() {
  const free = useIsFreePlan();
  const setReady = useAdsStore((s) => s.setReady);

  useEffect(() => {
    if (!free || started) return;
    started = true;
    (async () => {
      try {
        await AdsConsent.gatherConsent();
      } catch (e) {
        console.warn('ads: consent form failed', e);
      }
      const info = await AdsConsent.getConsentInfo().catch(() => null);
      if (info && !info.canRequestAds) return;
      if (Platform.OS === 'ios') {
        const current = await getTrackingPermissionsAsync().catch(() => null);
        if (current?.status === 'undetermined') await requestTrackingPermissionsAsync().catch(() => null);
      }
      await mobileAds().setRequestConfiguration({ maxAdContentRating: MaxAdContentRating.T, tagForChildDirectedTreatment: false, tagForUnderAgeOfConsent: false });
      await mobileAds().initialize();
      setReady(true);
    })().catch((e) => console.warn('ads: init failed', e));
  }, [free, setReady]);
}
