import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Android'de Google Haritalar API anahtarı olmadan harita açılırsa uygulama çöker.
 * Anahtar derlemeye eklenmediyse haritalar yerine radar / "Google Haritalar'da aç"
 * kartı gösterilir. iOS'ta Apple Haritalar anahtar istemez.
 */
export const nativeMapsAvailable = Platform.OS !== 'android' || Constants.expoConfig?.extra?.androidMapsKey === true;
