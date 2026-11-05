import type { ExpoConfig } from 'expo/config';

// iOS needs the *reversed* iOS client ID as a URL scheme for Google Sign-In.
// e.g. 1234-abc.apps.googleusercontent.com -> com.googleusercontent.apps.1234-abc
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const iosUrlScheme = iosClientId
  ? iosClientId.split('.').reverse().join('.')
  : 'com.googleusercontent.apps.placeholder';

const config: ExpoConfig = {
  name: 'Spark Lift',
  slug: 'spark-lift',
  scheme: 'sparklift',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  backgroundColor: '#0E0F12',
  ios: {
    bundleIdentifier: 'com.spark.lift',
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription: 'Attach a photo to your workout.',
      NSCameraUsageDescription: 'Take a photo for your workout.',
    },
  },
  android: {
    package: 'com.spark.lift',
    adaptiveIcon: {
      backgroundColor: '#0E0F12',
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
      monochromeImage: './assets/android-icon-monochrome.png',
    },
    predictiveBackGestureEnabled: false,
    // Read-only Health Connect access for daily steps and walking distance.
    permissions: ['android.permission.health.READ_STEPS', 'android.permission.health.READ_DISTANCE'],
  },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-sqlite',
    'expo-secure-store',
    'expo-sharing',
    'expo-apple-authentication',
    ['expo-notifications', { color: '#3D8BFF' }],
    ['expo-image-picker', { photosPermission: 'Attach a photo to your workout.' }],
    ['@react-native-google-signin/google-signin', { iosUrlScheme }],
    'react-native-health-connect',
    [
      '@kingstinct/react-native-healthkit',
      {
        NSHealthShareUsageDescription: 'Spark Lift reads your steps and walking distance to track daily activity and calories.',
        NSHealthUpdateUsageDescription: false,
        background: false,
      },
    ],
    // Health Connect needs Android 8.0+.
    ['expo-build-properties', { android: { minSdkVersion: 26 } }],
  ],
  experiments: { typedRoutes: false },
  extra: {
    eas: { projectId: process.env.EAS_PROJECT_ID },
  },
};

export default config;
