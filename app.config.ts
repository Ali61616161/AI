import type { ExpoConfig } from 'expo/config';

import brand from './src/config/brand.json';
import languages from './src/i18n/languages.json';

const config: ExpoConfig = {
  name: brand.name,
  slug: brand.slug,
  scheme: brand.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: brand.bundleId,
    supportsTablet: true,
    infoPlist: {
      // Sadece standart HTTPS şifrelemesi kullanılır (ihracat beyanı gerekmez).
      ITSAppUsesNonExemptEncryption: false,
    },
    // Apple'ın "gerekçeli API" beyanı (React Native ve AsyncStorage'ın kullandıkları).
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1', '0A2A.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1', '85F4.1'] },
      ],
      NSPrivacyTracking: false,
    },
  },
  // iOS'ta uygulama adı ve izin metinleri cihaz diline göre gösterilir.
  locales: Object.fromEntries(languages.map((l) => [l.code, `./assets/locales/${l.code}.json`])),
  android: {
    package: brand.bundleId,
    adaptiveIcon: {
      backgroundColor: brand.colors.coral,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Kullanılmayan izinler (bazı kütüphaneler varsayılan olarak ekler).
    blockedPermissions: ['android.permission.ACCESS_BACKGROUND_LOCATION', 'android.permission.SYSTEM_ALERT_WINDOW'],
  },
  web: {
    // Önizleme derlemesi tek sayfalık (single) çıktı kullanır: npm run preview:web
    output: process.env.EXPO_WEB_OUTPUT === 'single' ? 'single' : 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    [
      'expo-image-picker',
      {
        photosPermission: `${brand.name} uses your photos so you can upload ticket and booking screenshots.`,
        cameraPermission: `${brand.name} uses the camera so you can photograph tickets, bookings and menus.`,
        microphonePermission: `${brand.name} uses the microphone to translate your conversations.`,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: `${brand.name} uses your location to show places open near you and to adjust your plan.`,
        locationAlwaysAndWhenInUsePermission: false,
        isAndroidBackgroundLocationEnabled: false,
      },
    ],
    [
      'expo-speech-recognition',
      {
        microphonePermission: `${brand.name} uses the microphone to translate your conversations.`,
        speechRecognitionPermission: `${brand.name} turns your speech into text so it can be translated.`,
      },
    ],
    // iOS'ta Apple Haritalar kullanılır (anahtar gerekmez). Android'de Google Haritalar
    // için Android uygulamasına kısıtlı bir anahtar EAS ortam değişkeninden verilir.
    [
      'react-native-maps',
      {
        androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY,
      },
    ],
    [
      'expo-localization',
      {
        supportsRTL: true,
        supportedLocales: languages.map((l) => l.code),
      },
    ],
    [
      'expo-splash-screen',
      {
        backgroundColor: brand.colors.midnight,
        image: './assets/images/splash-icon.png',
        imageWidth: 120,
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    eas: { projectId: brand.easProjectId },
  },
};

export default config;
