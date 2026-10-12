import { AdsConsent } from 'react-native-google-mobile-ads';

/** Kullanıcının reklam onayını sonradan değiştirebileceği Google formu. */
export function openAdPrivacyOptions() {
  return AdsConsent.showPrivacyOptionsForm().catch((e) => console.warn('ads: privacy options failed', e));
}
export const adPrivacyOptionsAvailable = true;
