import type { ConfigContext, ExpoConfig } from "expo/config";

const BACKGROUND = "#F6F1E9";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "18Roots",
  slug: "18roots",
  scheme: "roots18",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "org.roots18.app",
    buildNumber: "1",
    supportsTablet: false,
    infoPlist: {
      NSCameraUsageDescription: "The camera is used for video consultations with your doctor.",
      NSMicrophoneUsageDescription: "The microphone is used for video consultations with your doctor.",
      UIBackgroundModes: ["audio"],
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: "org.roots18.app",
    versionCode: 1,
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: BACKGROUND },
    permissions: ["CAMERA", "RECORD_AUDIO", "MODIFY_AUDIO_SETTINGS", "BLUETOOTH_CONNECT", "POST_NOTIFICATIONS"],
    // Added by libraries but not used by 18Roots. Store review flags them, and
    // patients should not be asked for them.
    blockedPermissions: [
      "android.permission.SYSTEM_ALERT_WINDOW",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
  },
  web: { bundler: "metro", output: "single", favicon: "./assets/favicon.png" },
  plugins: [
    "expo-router",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 160, backgroundColor: BACKGROUND }],
    "expo-secure-store",
    ["expo-notifications", { icon: "./assets/notification-icon.png", color: "#4C6955" }],
    "expo-font",
    "expo-localization",
    "@livekit/react-native-expo-plugin",
    "@config-plugins/react-native-webrtc",
  ],
  extra: {
    eas: process.env.EAS_PROJECT_ID ? { projectId: process.env.EAS_PROJECT_ID } : undefined,
  },
});
