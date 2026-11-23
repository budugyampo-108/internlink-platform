import type { ExpoConfig } from 'expo/config';

// Secrets are read from the build environment (apps/mobile/.env or EAS secrets) — never hardcoded.
const config: ExpoConfig = {
  name: 'InternLink',
  slug: 'internlink',
  scheme: 'internlink',
  version: '0.1.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: {
    bundleIdentifier: 'com.example.internlink', // ← change
    supportsTablet: true,
    config: { googleMapsApiKey: process.env.GOOGLE_MAPS_IOS_API_KEY },
    infoPlist: {
      NSLocationWhenInUseUsageDescription: 'InternLink uses your location to show attachment opportunities near you.',
      NSMicrophoneUsageDescription: 'InternLink uses the microphone so you can dictate chat messages.',
      NSSpeechRecognitionUsageDescription: 'InternLink converts your speech to text for chat messages.',
    },
  },
  android: {
    package: 'com.example.internlink', // ← change
    config: { googleMaps: { apiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY } },
    permissions: ['ACCESS_COARSE_LOCATION', 'ACCESS_FINE_LOCATION', 'RECORD_AUDIO'],
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    ['expo-location', { locationWhenInUsePermission: 'InternLink uses your location to show attachment opportunities near you.' }],
    [
      'expo-speech-recognition',
      {
        microphonePermission: 'InternLink uses the microphone so you can dictate chat messages.',
        speechRecognitionPermission: 'InternLink converts your speech to text for chat messages.',
      },
    ],
  ],
  // NOTE: react-native-maps (Google provider) and expo-speech-recognition need a development build
  // (`npx expo run:android` / EAS build) — they do not run inside Expo Go.
};

export default config;
