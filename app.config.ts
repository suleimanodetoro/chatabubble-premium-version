import "dotenv/config";
import { ExpoConfig, ConfigContext } from "expo/config";

// Define the structure for your extra config if needed for type safety
interface ExtraConfig {
  OPENAI_API_KEY?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  revenuecatIosKey?: string;
  revenuecatAndroidKey?: string;
  eas?: {
    projectId?: string;
  };
}

export default ({ config }: ConfigContext): ExpoConfig => {
  // Load environment variables
  const extra: ExtraConfig = {
    OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    revenuecatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
    revenuecatAndroidKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    eas: {
      projectId: "afbf9fed-c929-4158-835a-23db81e415bf"
    }
  };

  // Log loaded keys during development for debugging
  if (process.env.NODE_ENV === "development") {
    console.log("App Config - Loaded Environment Variables:");
    console.log(
      "  OPENAI_API_KEY:",
      extra.OPENAI_API_KEY ? "Present" : "MISSING"
    );
    console.log("  supabaseUrl:", extra.supabaseUrl ? "Present" : "MISSING");
    console.log(
      "  supabaseAnonKey:",
      extra.supabaseAnonKey ? "Present" : "MISSING"
    );
    console.log(
      "  revenuecatIosKey:",
      extra.revenuecatIosKey ? "Present" : "MISSING"
    );
    console.log(
      "  revenuecatAndroidKey:",
      extra.revenuecatAndroidKey ? "Present" : "MISSING"
    );
  }

  // Return the final configuration object
  return {
    // Spread the existing static config (useful if you pass base config)
    ...config,
    // --- Static Config Merged from app.json ---
    name: "Chatabubble",
    slug: "chatabubble",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png", // Ensure this points to your 1024x1024 source icon
    scheme: "chatabubble", // Define scheme once
    userInterfaceStyle: "automatic",
    // newArchEnabled: true, // Include if you intend to use the new architecture

    splash: {
      image: "./assets/images/splash-icon.png", // Ensure this exists
      resizeMode: "contain",
      backgroundColor: "#ffffff",
    },

    // assetBundlePatterns: [ // Include if needed, e.g., for specific assets
    //   "**/*"
    // ],

    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.chatabubble.mobile", 
      usesAppleSignIn: true,
      icon:{
        dark:"./assets/icons/ios-dark.png",
        light:"./assets/icons/ios-light.png",
        tinted:"./assets/icons/ios-tinted.png"

      }, 
      infoPlist: {
        SKAdNetworkItems: [
          {
            SKAdNetworkIdentifier: "2U9PT9HC89.skadnetwork", // This ID belongs to Google
          },
        ],
      },
    },

    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/icons/adaptive-icon.png",
        monochromeImage:"./assets/icons/adaptive-icon.png",
        backgroundImage:"./assets/icons/adaptive-icon.png", 
        backgroundColor: "#ffffff",
      },
      package: "com.chatabubble.mobile",
    },

    web: {
      bundler: "metro", 
      output: "static", 
      favicon: "./assets/images/favicon.png", // Ensure this exists
    },

    // --- Merged Plugins ---
    plugins: [
      ["expo-router", { root: "./app" }], // Use the more specific config from app.config.ts
      "expo-font", // From app.config.ts
      [
        "expo-splash-screen",
        {
          // From app.json splash config (redundant if using top-level splash key, but safe to keep)
          image: "./assets/icons/splash-icon-dark.png",
          imageWidth:200,
          resizeMode: "contain",
          backgroundColor: "#ffffff",
          dark:{
            image: "./assets/icons/splash-icon-light.png",
            backgroundColor: "#000000",
          }
        },
      ],
      // Add other plugins here if needed
    ],

    // --- Experiments (Keep if using typed routes) ---
    experiments: {
      typedRoutes: true,
    },

    // --- Extra section for environment variables ---
    extra: extra,
  };
};
