// lib/services/auth.ts
import { supabase } from "@/lib/supabase/client";
import { ProfileService } from "./profile";
import { EncryptionService } from "./encryption";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";

const KEY_STATUS = "@key_status:";
const SITE_URL = "https://chatabubble.com";

WebBrowser.maybeCompleteAuthSession();

export class AuthService {
  private static redirectUrl = Linking.createURL("auth/debug");
  static async signInWithApple() {
    try {
      if (Platform.OS !== "ios") {
        throw new Error("Apple Sign In is only available on iOS devices");
      }

      // Clear any existing session
      await supabase.auth.signOut();
      await AsyncStorage.removeItem("supabase.auth.token");

      // Get credential from Apple
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      // Sign in to Supabase with the Apple credential
      const {
        data: { user },
        error,
      } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken!,
      });

      if (error) throw error;
      if (!user) throw new Error("No user returned from Supabase");

      await this.setupUserAfterAuth(user, "social");
      return user;
    } catch (error: any) {
      if (error.code === "ERR_CANCELED") {
        // User canceled the sign in
        return null;
      }
      console.error("Error in Apple sign in:", error);
      throw error;
    }
  }

  static async signInWithGoogle() {
    try {
      // Clear any existing session
      await supabase.auth.signOut();
      await AsyncStorage.removeItem("supabase.auth.token");

      console.log("Starting Google sign in...");
      console.log("Redirect URL:", this.redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: this.redirectUrl,
          queryParams: {
            prompt: "select_account",
          },
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error("No OAuth URL returned");

      console.log("Opening auth session with URL:", data.url);
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        this.redirectUrl
      );

      console.log("Auth session result:", result);

      if (result.type === "success") {
        // Parse the URL to extract access_token
        const url = result.url;
        const hashedPart = url.split("#")[1];
        if (!hashedPart) throw new Error("No token in redirect URL");

        const params = new URLSearchParams(hashedPart);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");

        if (access_token) {
          // Set the session manually
          const { data: sessionData, error: sessionError } =
            await supabase.auth.setSession({
              access_token,
              refresh_token: refresh_token || "",
            });

          if (sessionError) throw sessionError;

          if (sessionData.session?.user) {
            await this.setupUserAfterAuth(sessionData.session.user, "social");
            return sessionData.session.user;
          }
        }
      }

      await WebBrowser.dismissAuthSession();
      return null;
    } catch (error) {
      console.error("Error in Google sign in:", error);
      throw error;
    }
  }

  private static async setupUserAfterAuth(
    user: any,
    authType: "password" | "social"
  ) {
    console.log("Setting up user after auth:", user.id);

    try {
      // Create or get profile with retries
      let profile = null;
      let retryCount = 0;
      const maxRetries = 3;

      while (!profile && retryCount < maxRetries) {
        try {
          profile = await ProfileService.setupProfile(user.id, user.email);
          if (profile) {
            console.log("Profile setup successful:", profile);
            break;
          }
        } catch (error) {
          console.error(
            `Profile setup attempt ${retryCount + 1} failed:`,
            error
          );
          retryCount++;
          if (retryCount === maxRetries) throw error;
          await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second between retries
        }
      }

      // Set up encryption if needed
      const keyStatus = await AsyncStorage.getItem(`${KEY_STATUS}${user.id}`);
      if (!keyStatus) {
        console.log("Setting up encryption for user:", user.id);
        await EncryptionService.generateUserKey(user.id, user.email, authType);
        await AsyncStorage.setItem(`${KEY_STATUS}${user.id}`, "generated");
      }

      // Set auth persistence
      await AsyncStorage.setItem(
        "supabase.auth.token",
        JSON.stringify({
          access_token: (
            await supabase.auth.getSession()
          ).data.session?.access_token,
          user_id: user.id,
        })
      );

      return true;
    } catch (error) {
      console.error("Error in setupUserAfterAuth:", error);
      // Don't throw here - we want to continue even if profile setup fails
      // The user can still use the app, we'll try to set up the profile later
      return true;
    }
  }

  static async signUp(email: string, password: string) {
    try {
      console.log("Starting signup process...");

      const {
        data: { user },
        error,
      } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${SITE_URL}/auth/callback?redirect=${encodeURIComponent(
            this.redirectUrl
          )}`,
        },
      });

      if (error) throw error;
      if (!user) throw new Error("No user returned after signup");

      await this.setupUserAfterAuth(user, "password");
      return user;
    } catch (error) {
      console.error("Error in signUp:", error);
      throw error;
    }
  }

  static async signIn(email: string, password: string) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      if (!user) throw new Error("No user returned after signin");

      await this.setupUserAfterAuth(user, "password");
      return user;
    } catch (error) {
      console.error("Error in signIn:", error);
      throw error;
    }
  }

  static async signOut() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        await AsyncStorage.removeItem(`${KEY_STATUS}${user.id}`);
        await AsyncStorage.removeItem("supabase.auth.token");
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Error in signOut:", error);
      throw error;
    }
  }

  static async resetPassword(email: string) {
    try {
      const resetRedirectUrl = Linking.createURL("auth/reset-callback");
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${SITE_URL}/auth/reset-password?redirect=${encodeURIComponent(
          resetRedirectUrl
        )}`,
      });
      if (error) throw error;
    } catch (error) {
      console.error("Error in resetPassword:", error);
      throw error;
    }
  }
}
