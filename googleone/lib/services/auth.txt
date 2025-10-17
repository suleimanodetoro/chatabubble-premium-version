// lib/services/auth.ts

import { supabase } from "@/lib/supabase/client";
import { ProfileService } from "./profile";
import { EncryptionService } from "./encryption";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { Platform, Alert } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { StorageService } from "./storage"; // For local data cleanup
import { SessionManager } from "./sessionManager"; // For session cleanup

const KEY_STATUS_PREFIX = "@key_status:"; // Consistent prefix
const AUTH_TYPE_KEY_PREFIX = "@auth_type_"; // Consistent prefix
const ONBOARDING_COMPLETED_KEY_PREFIX = "@onboarding_completed:"; // From ProfileService

WebBrowser.maybeCompleteAuthSession(); // For OAuth flows

export class AuthService {
  // Used by OAuth debug flows; leave as-is
  private static redirectUrl = Linking.createURL("auth/debug");

  /** Delete a user's entire account (local + remote data) */
  static async deleteAccount(
    userId: string,
    email: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      console.log(
        `AuthService: Starting account deletion process for user: ${userId}, email: ${email}`
      );

      // 1. Clean up all local data
      await this.cleanupLocalData(userId);

      // 2. Delete user data in your database tables
      await this.deleteRemoteUserData(userId);

      // 3. Sign the user out
      await supabase.auth.signOut();
      console.log(`AuthService: Signed out user ${userId} as part of account deletion.`);

      return { success: true };
    } catch (err) {
      console.error(`AuthService: Error deleting account for user ${userId}:`, err);
      return {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Failed to delete account. Please try again.",
      };
    }
  }

  private static async cleanupLocalData(userId: string): Promise<void> {
    console.log(`AuthService: Cleaning up local data for user ${userId}`);
    try {
      // Encryption key
      await EncryptionService.removeEncryptionKey(userId);
      // Session + Storage
      await SessionManager.cleanup(userId);
      await StorageService.clearUserData(userId);
      // Onboarding flag
      await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
      // Supabase token
      await AsyncStorage.removeItem("supabase.auth.token");
      console.log(`AuthService: Local data cleanup finished for ${userId}`);
    } catch (err) {
      console.error(`AuthService: Error in local cleanup for ${userId}:`, err);
    }
  }

  private static async deleteRemoteUserData(userId: string): Promise<void> {
    console.log(`AuthService: Deleting remote DB data for ${userId}`);
    try {
      let res = await supabase.from("chat_sessions").delete().eq("user_id", userId);
      if (res.error) console.error("Error deleting chat sessions:", res.error);
      res = await supabase.from("scenarios").delete().eq("created_by", userId);
      if (res.error) console.error("Error deleting scenarios:", res.error);
      res = await supabase.from("profiles").delete().eq("id", userId);
      if (res.error) console.error("Error deleting profile:", res.error);
      console.log(`AuthService: Remote data deletion finished for ${userId}`);
    } catch (err) {
      console.error(`AuthService: Remote deletion error for ${userId}:`, err);
      throw err;
    }
  }

  /** Sign in with Apple (iOS only) */
  static async signInWithApple() {
    if (Platform.OS !== "ios") throw new Error("Apple Sign In is iOS-only");
    try {
      await supabase.auth.signOut().catch(() => {});
      await AsyncStorage.removeItem("supabase.auth.token");
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      if (!credential.identityToken) {
        throw new Error("No identity token from Apple");
      }
      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "apple",
        token: credential.identityToken,
      });
      if (error) throw error;
      await this.setupUserAfterAuth(data.user!, "social");
      return data.user;
    } catch (err: any) {
      if (err.code === "ERR_CANCELED") return null;
      console.error("AuthService: Apple sign-in error:", err);
      throw err;
    }
  }

  /** Sign in with Google via OAuth */
  static async signInWithGoogle() {
    try {
      await supabase.auth.signOut().catch(() => {});
      await AsyncStorage.removeItem("supabase.auth.token");
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: this.redirectUrl, queryParams: { prompt: "select_account" } },
      });
      if (error) throw error;
      const result = await WebBrowser.openAuthSessionAsync(data.url!, this.redirectUrl);
      if (result.type !== "success") return null;
      // Supabase client picks up session automatically
      return null;
    } catch (err) {
      WebBrowser.dismissAuthSession();
      console.error("AuthService: Google sign-in error:", err);
      throw err;
    }
  }

  /** Common post-auth setup (encryption key, auth-type) */
  private static async setupUserAfterAuth(
    user: { id: string; email?: string | null },
    authType: "password" | "social"
  ): Promise<boolean> {
    if (!user || !user.id || !user.email) return false;
    try {
      await AsyncStorage.setItem(`${AUTH_TYPE_KEY_PREFIX}${user.id}`, authType);
      await EncryptionService.ensureEncryptionKey(user.id, user.email);
      return true;
    } catch (err) {
      console.error("AuthService: setupUserAfterAuth error:", err);
      return false;
    }
  }

  /** EMAIL/PASSWORD SIGNUP → sends confirmation link to chatabubble://confirm  */
  static async signUp(
    email: string,
    password: string
  ): Promise<{ user: any | null; error: Error | null }> {
    try {
      console.log("AuthService: Starting email/password signup...");
      // ← updated: redirect to /confirm instead of /auth/confirm
      const emailRedirectURL = Linking.createURL("confirm");
      console.log("AuthService: Email confirmation redirect URL:", emailRedirectURL);

      const { data, error } = await supabase.auth.signUp(
        { email: email.trim().toLowerCase(), password },
        { redirectTo: emailRedirectURL }
      );
      if (error) throw error;
      console.log(`AuthService: Signup initiated for ${data.user?.id}`);
      return { user: data.user!, error: null };
    } catch (err) {
      console.error("AuthService: Email signup error:", err);
      return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  /** EMAIL/PASSWORD SIGNIN */
  static async signIn(email: string, password: string): Promise<{ user: any | null; error: Error | null }> {
    try {
      await supabase.auth.signOut().catch(() => {});
      await AsyncStorage.removeItem("supabase.auth.token");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) throw error;
      await this.setupUserAfterAuth(data.user!, "password");
      return { user: data.user!, error: null };
    } catch (err) {
      console.error("AuthService: Signin error:", err);
      return { user: null, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  /** SIGN OUT and cleanup */
  static async signOut() {
    try {
      const { data } = await supabase.auth.getUser();
      await supabase.auth.signOut();
      if (data.user?.id) await this.cleanupLocalData(data.user.id);
    } catch (err) {
      console.error("AuthService: Signout error:", err);
      await AsyncStorage.removeItem("supabase.auth.token");
      throw err;
    }
  }

  /** INITIATE PASSWORD RESET */
  static async resetPassword(email: string): Promise<{ success: boolean; error?: Error | null }> {
    try {
      console.log("AuthService: Initiating password reset for:", email);
      const resetRedirectUrl = Linking.createURL("reset-callback");
      console.log("AuthService: Reset redirect URL:", resetRedirectUrl);
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: resetRedirectUrl,
      });
      if (error) throw error;
      return { success: true, error: null };
    } catch (err) {
      console.error("AuthService: Reset email error:", err);
      return { success: false, error: err instanceof Error ? err : new Error(String(err)) };
    }
  }

  /** HANDLE PASSWORD UPDATE for logged-in user */
  static async updatePassword(userId: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data, error: getUserError } = await supabase.auth.getUser();
      if (getUserError) throw getUserError;
      const userEmail = data.user?.email;
      if (!userEmail || data.user.id !== userId) throw new Error("User mismatch");

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;

      const authType = (await AsyncStorage.getItem(`${AUTH_TYPE_KEY_PREFIX}${userId}`)) || "password";
      if (authType === "password") {
        await EncryptionService.generateUserKey(userId, newPassword, "password");
        await AsyncStorage.setItem(`${KEY_STATUS_PREFIX}${userId}`, "regenerated_post_password_update");
      } else {
        await EncryptionService.ensureEncryptionKey(userId, userEmail);
      }

      return { success: true };
    } catch (err) {
      console.error("AuthService: updatePassword error:", err);
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}
