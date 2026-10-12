import { Platform } from 'react-native';

/**
 * Reklam birimi kimlikleri (AdMob panelinden; herkese açık değerler). Ayarlanmadıysa
 * Google'ın test birimleri kullanılır: reklam görünür ama gelir getirmez.
 */
const env = {
  ios: { native: process.env.EXPO_PUBLIC_ADMOB_IOS_NATIVE, rewarded: process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED },
  android: { native: process.env.EXPO_PUBLIC_ADMOB_ANDROID_NATIVE, rewarded: process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED },
};

const TEST = {
  ios: { native: 'ca-app-pub-3940256099942544/3986624511', rewarded: 'ca-app-pub-3940256099942544/1712485313' },
  android: { native: 'ca-app-pub-3940256099942544/2247696110', rewarded: 'ca-app-pub-3940256099942544/5224354917' },
};

const platform = Platform.OS === 'android' ? 'android' : 'ios';

export const AD_UNITS = {
  native: env[platform].native || TEST[platform].native,
  rewarded: env[platform].rewarded || TEST[platform].rewarded,
};

/** Ödüllü reklamla +1 hak verilebilen özellikler (sunucudaki liste ile aynı). */
export const REWARDABLE_FEATURES = ['nearby_search', 'text_translation', 'travel_info', 'weather'] as const;
export type RewardableFeature = (typeof REWARDABLE_FEATURES)[number];
