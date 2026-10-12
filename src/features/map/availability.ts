import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { PROVIDER_GOOGLE } from 'react-native-maps';

/**
 * Android'de Google Haritalar API anahtarı olmadan harita açılırsa uygulama çöker.
 * Anahtar derlemeye eklenmediyse haritalar yerine radar / "Google Haritalar'da aç"
 * kartı gösterilir. iOS'ta Apple Haritalar anahtar istemez.
 */
export const nativeMapsAvailable = Platform.OS !== 'android' || Constants.expoConfig?.extra?.androidMapsKey === true;

/**
 * iOS'ta Google Haritalar anahtarı derlemeye eklendiyse iki platformda da aynı (koyu,
 * özel stilli) Google haritası kullanılır; yoksa Apple Haritalar.
 */
export const googleOnIos = Platform.OS === 'ios' && Constants.expoConfig?.extra?.iosMapsKey === true;
export const mapProvider = googleOnIos ? PROVIDER_GOOGLE : undefined;
/** Özel koyu stil sadece Google haritasında uygulanır. */
export const usesGoogleMap = Platform.OS === 'android' || googleOnIos;
