import * as Application from 'expo-application';
import { Platform } from 'react-native';

/**
 * Cihazın uygulamaya özel kimliği (iOS: identifierForVendor, Android: ANDROID_ID).
 * Sunucuya gönderilir, orada sadece SHA-256 özeti saklanır; davet kötüye kullanımını önler.
 */
export async function getDeviceId(): Promise<string | null> {
  try {
    if (Platform.OS === 'ios') return await Application.getIosIdForVendorAsync();
    if (Platform.OS === 'android') return Application.getAndroidId();
  } catch {
    // Kimlik alınamazsa davet kodu kullanılamaz (sunucu "device_required" döner).
  }
  return null;
}
