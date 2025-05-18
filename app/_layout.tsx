// app/_layout.tsx
import "react-native-get-random-values";
import { useEffect, useState, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { useColorScheme } from "@/hooks/useColorScheme";
import { supabase } from "@/lib/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useAppStore } from "@/hooks/useAppStore";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProfileService } from "@/lib/services/profile";
import { StatusBar } from "expo-status-bar";
import { ThemeProvider } from "@/lib/theme/ThemeProvider";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Alert } from "react-native";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSessionState] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [initialRouteDetermined, setInitialRouteDetermined] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { setUser } = useAppStore();
  const isPasswordResetFlow = useRef(false);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      console.log("RootLayout: Initializing auth state...");
      try {
        const resetFlow = await AsyncStorage.getItem("@is_password_reset");
        if (resetFlow === "true") {
          isPasswordResetFlow.current = true;
        }

        const {
          data: { session: currentSession },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError) {
          console.error(
            "RootLayout: Error getting initial session:",
            sessionError.message
          );
        }
        setSessionState(currentSession);

        if (currentSession?.user) {
          const profile = await ProfileService.getProfile(
            currentSession.user.id
          );
          setUser(
            profile ?? {
              id: currentSession.user.id,
              email: currentSession.user.email ?? "",
              name:
                currentSession.user.email?.split("@")[0] ??
                "User",
            }
          );
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("RootLayout: Auth initialization error:", error);
      } finally {
        setIsLoading(false);
        setInitialRouteDetermined(true);
      }
    };
    initializeAuth();
  }, [setUser]);

  // Handle auth state changes
  useEffect(() => {
    console.log("RootLayout: Setting up auth state change listener...");
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        console.log(
          `RootLayout: Auth state changed - Event: ${event}, Session: ${
            newSession ? `User ${newSession.user.id}` : "No session"
          }`
        );
        setSessionState(newSession);

        if (event === "SIGNED_IN" && newSession?.user) {
          setIsSigningIn(true);
          try {
            // small delay for splash or similar
            await new Promise((r) => setTimeout(r, 1000));
            const profile = await ProfileService.getProfile(
              newSession.user.id
            );
            setUser(
              profile ?? {
                id: newSession.user.id,
                email: newSession.user.email ?? "",
                name:
                  newSession.user.email?.split("@")[0] ??
                  "User",
              }
            );

            const resetFlow = await AsyncStorage.getItem(
              "@is_password_reset"
            );
            if (resetFlow === "true") {
              setIsSigningIn(false);
              return;
            }

            console.log("RootLayout: SIGNED_IN - Redirecting to home.");
            router.replace("/");
          } catch (error) {
            console.error(
              "RootLayout: SIGNED_IN - Error during post-sign-in:",
              error
            );
            router.replace("/login");
          } finally {
            setIsSigningIn(false);
          }
        } else if (event === "SIGNED_OUT") {
          console.log(
            "RootLayout: SIGNED_OUT - Clearing session and redirecting to login."
          );
          setUser(null);
          await AsyncStorage.removeItem("supabase.auth.token");
          await AsyncStorage.removeItem("@is_password_reset");
          isPasswordResetFlow.current = false;
          router.replace("/login");
          setIsSigningIn(false);
        } else if (event === "PASSWORD_RECOVERY") {
          console.log("RootLayout: PASSWORD_RECOVERY - Entering reset flow.");
          isPasswordResetFlow.current = true;
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [router, setUser, segments]);

  // Handle deep linking (signup & recovery)
  useEffect(() => {
    let deepLinkProcessing = false;

    const handleDeepLink = async ({ url }: { url: string | null }) => {
      if (!url || deepLinkProcessing) return;
      deepLinkProcessing = true;
      console.log("RootLayout: Deep link received:", url);

      // split off the fragment (#)
      const [, fragment = ""] = url.split("#");
      const params = new URLSearchParams(fragment);
      const accessToken = params.get("access_token");
      const type = params.get("type");
      const error = params.get("error");
      const errorCode = params.get("error_code");
      const errorDescription = params.get("error_description");

      if (accessToken && type === "signup") {
        // store for confirm screen if needed
        await AsyncStorage.setItem("@sb_access_token", accessToken);
        router.replace({
          pathname: "/confirm",
          params: Object.fromEntries(params.entries()),
        });
      } else if (error || errorCode) {
        const message =
          errorDescription?.replace(/\+/g, " ") ?? "An error occurred.";
        if (errorCode === "otp_expired" || type === "recovery") {
          await AsyncStorage.setItem(
            "@reset_error",
            JSON.stringify({ code: errorCode || error, message })
          );
          router.replace("/forgot-password");
        } else {
          Alert.alert("Link Error", message);
        }
      } else if (accessToken && type === "recovery") {
        await AsyncStorage.setItem("@is_password_reset", "true");
        isPasswordResetFlow.current = true;
        router.replace({
          pathname: "/reset-password",
          params: Object.fromEntries(params.entries()),
        });
      }

      deepLinkProcessing = false;
    };

    Linking.getInitialURL().then((url) => handleDeepLink({ url }));
    const sub = Linking.addEventListener("url", handleDeepLink);
    return () => sub.remove();
  }, [router]);

  // Route protection
  useEffect(() => {
    if (isLoading || !initialRouteDetermined || isSigningIn) return;

    const inAuthGroup = segments[0] === "(auth)";
    if (!session && !inAuthGroup) {
      router.replace("/login");
    }
  }, [session, segments, isLoading, initialRouteDetermined, isSigningIn, router]);

  if (isLoading && !initialRouteDetermined) {
    return null;
  }

  const commonStackOptions = { headerShown: false };

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <StatusBar
          style={colorScheme === "dark" ? "light" : "dark"}
        />
        <Stack screenOptions={commonStackOptions}>
          <Stack.Screen name="(auth)" options={{ animation: "slide_from_bottom" }} />
          <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
          <Stack.Screen name="(chat)" />
          <Stack.Screen
            name="create-scenario"
            options={{ presentation: "modal", title: "Create Scenario" }}
          />
        </Stack>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
