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
  },
  android: {
    package: brand.bundleId,
    adaptiveIcon: {
      backgroundColor: brand.colors.coral,
      foregroundImage: './assets/images/android-icon-foreground.png',
      backgroundImage: './assets/images/android-icon-background.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
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
        microphonePermission: false,
      },
    ],
    [
      'expo-location',
      {
        locationWhenInUsePermission: `${brand.name} uses your location to suggest places near you when you change your plan.`,
        locationAlwaysAndWhenInUsePermission: false,
        isAndroidBackgroundLocationEnabled: false,
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
};

export default config;
