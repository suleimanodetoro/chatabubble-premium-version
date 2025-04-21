import "dotenv/config";

export default {
  expo: {
    scheme: "chatabubble",
    android: {
      package: "com.chatabubble.mobile"
    },
    ios: {
      bundleIdentifier: "com.chatabubble.mobile"
    },
    plugins: [
        [
          "expo-router",
          {
            root: "./app",
          },
        ],
        "expo-font"
      ],
    web: {
      bundler: "metro"
    },
    // Explicit deep link handling
    scheme: "chatabubble",
    extra: {
      OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
      
    },
  },
};
