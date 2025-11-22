export default {
  expo: {
    name: "REcipe",
    slug: "recipe-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    jsEngine: "hermes",
    assetBundlePatterns: [
      "**/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.rewindzxc.recipe"
    },
    android: {
      package: "com.rewindzxc.recipe",
      versionCode: 2,  // ✅ Increment version
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      permissions: [
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "RECEIVE_BOOT_COMPLETED",
        "VIBRATE",
        "POST_NOTIFICATIONS",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ],
      googleServicesFile: "./android/google-services.json",
      usesCleartextTraffic: true,  // ✅ CRITICAL
      networkSecurityConfig: "./android/app/src/main/res/xml/network_security_config.xml"  // ✅ NEW
    },
    plugins: [
      "expo-router",
      [
        "expo-camera",
        {
          "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera for food recognition"
        }
      ],
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#ffffff",
          "sounds": [
            "./assets/notification.wav"
          ]
        }
      ],
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true,
            "networkSecurityConfig": "@xml/network_security_config",
            "compileSdkVersion": 34,
            "targetSdkVersion": 34,
            "buildToolsVersion": "34.0.0"
          }
        }
      ]
    ],
    extra: {
      router: {
        origin: false
      },
      eas: {
        projectId: "5f5dd904-b1b3-436d-8cc7-3cfd6566fa95"
      },
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      edamamAppId: process.env.EXPO_PUBLIC_EDAMAM_APP_ID,
      edamamAppKey: process.env.EXPO_PUBLIC_EDAMAM_APP_KEY,
      foodApiUrl: process.env.EXPO_PUBLIC_FOOD_API_URL,
      appEnv: process.env.EXPO_PUBLIC_APP_ENV,
      fatsecretClientId: process.env.EXPO_PUBLIC_FATSECRET_CLIENT_ID,
      fatsecretClientSecret: process.env.EXPO_PUBLIC_FATSECRET_CLIENT_SECRET,
    }
  }
};