// app/_layout.tsx
import "react-native-get-random-values";
import { useEffect, useState, useRef } from "react";
import { Stack } from "expo-router";
import { useRouter, useSegments } from "expo-router";
import { useColorScheme } from "@/hooks/useColorScheme";
import { supabase } from "@/lib/supabase/client";
import { Session } from "@supabase/supabase-js";
import { useAppStore } from "@/hooks/useAppStore";
import * as Linking from "expo-linking";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ProfileService } from "@/lib/services/profile";
import { StatusBar } from 'expo-status-bar';
import { ThemeProvider } from "@/lib/theme/ThemeProvider";

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false); // Track sign-in process
  const router = useRouter();
  const segments = useSegments();
  const { setUser } = useAppStore();
  const authChangeHandled = useRef(false);
  const isProcessingDeepLink = useRef(false); // Track deep link processing

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check for stored session
        const storedAuth = await AsyncStorage.getItem("supabase.auth.token");
        if (storedAuth) {
          const { access_token } = JSON.parse(storedAuth);
          if (access_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token: "",
            });
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        console.log(
          "Initial session check:",
          session ? "Has session" : "No session"
        );
        setSession(session);

        if (session?.user) {
          // Get the user profile from the database
          const profile = await ProfileService.getProfile(session.user.id);

          // Set user in app store with the basic auth info if no profile found
          setUser(
            profile || {
              id: session.user.id,
              email: session.user.email,
              name: session.user.email?.split("@")[0] || "",
            }
          );
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(
        "Auth state changed:",
        event,
        session ? "Has session" : "No session"
      );

      // Mark sign-in in progress to prevent route protection from redirecting
      if (event === "SIGNED_IN" || event === "USER_UPDATED") {
        setIsSigningIn(true);
      }

      if (event === "SIGNED_IN" && session) {
        setSession(session);

        // Get the complete user profile
        const profile = await ProfileService.getProfile(session.user.id);

        // Use profile data if available, otherwise use basic auth info
        setUser(
          profile || {
            id: session.user.id,
            email: session.user.email,
            name: session.user.email?.split("@")[0] || "",
          }
        );

        // Add a small delay to ensure state is updated before navigation
        setTimeout(() => {
          console.log("Redirecting to tabs after successful sign-in");
          router.replace("/(tabs)");
          // Reset the sign-in flag after navigation
          setTimeout(() => {
            setIsSigningIn(false);
          }, 500);
        }, 500);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem("supabase.auth.token");
        router.replace("/(auth)/login");
        setIsSigningIn(false);
      } else if (event === "USER_UPDATED" && session) {
        // Handle user update events (like password changes)
        console.log("User updated, refreshing session data");
        setSession(session);
        
        // No need to redirect here, we'll let the Alert navigation handle it
        setTimeout(() => {
          setIsSigningIn(false);
        }, 500);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle deep linking
  useEffect(() => {
    // First, check if there are any pending deep links
    const checkInitialURL = async () => {
      try {
        const initialURL = await Linking.getInitialURL();
        if (initialURL) {
          console.log("Initial deep link detected:", initialURL);
          isProcessingDeepLink.current = true;
          await handleDeepLink({ url: initialURL });
          isProcessingDeepLink.current = false;
        }
      } catch (e) {
        console.error("Error checking initial URL:", e);
        isProcessingDeepLink.current = false;
      }
    };

    checkInitialURL();

    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log("Deep link received:", url);
      isProcessingDeepLink.current = true;

      try {
        // Handle URL-encoded fragments properly
        const decodedUrl = decodeURIComponent(url);
        console.log("Decoded URL:", decodedUrl);

        // Parse the URL and extract components
        const urlParts = decodedUrl.split("#");
        const baseUrl = urlParts[0];
        const fragment = urlParts.length > 1 ? urlParts[1] : "";

        console.log("URL Base:", baseUrl, "Fragment:", fragment);

        // Check for access_token in the fragment (password reset case)
        if (fragment && fragment.includes("access_token=")) {
          console.log("Access token found in fragment - processing reset");
          
          // Extract tokens from fragment
          const fragmentParams: Record<string, string> = {};
          fragment.split("&").forEach((pair) => {
            const [key, value] = pair.split("=");
            if (key && value) fragmentParams[key] = value;
          });
          
          console.log("Found tokens, attempting to set session");
          
          // Attempt to set the session with the token
          if (fragmentParams.access_token) {
            const { error } = await supabase.auth.setSession({
              access_token: fragmentParams.access_token,
              refresh_token: fragmentParams.refresh_token || '',
            });
            
            if (error) {
              console.error("Error setting session:", error);
              // Store error for display
              await AsyncStorage.setItem('@reset_error', JSON.stringify({
                code: 'session_error',
                message: error.message || 'Failed to validate reset token'
              }));
              router.replace("/(auth)/forgot-password");
              isProcessingDeepLink.current = false;
              return;
            }
            
            // Session was set successfully - now check if it's valid
            const { data: { session: newSession } } = await supabase.auth.getSession();
            
            if (newSession) {
              console.log("Successfully established session from reset token");
              
              // Now we're ready to navigate to the reset password screen
              router.replace({
                pathname: "/(auth)/reset-password",
                params: {
                  access_token: fragmentParams.access_token,
                  refresh_token: fragmentParams.refresh_token || '',
                  type: fragmentParams.type || 'recovery'
                }
              });
              
              isProcessingDeepLink.current = false;
              return;
            }
          }
        }

        // Check for error parameters in fragment
        if (fragment && (fragment.includes("error=") || fragment.includes("error_code="))) {
          // This is a password reset error
          console.log("Password reset error detected in fragment");

          // Parse fragment parameters
          const fragmentParams: Record<string, string> = {};
          fragment.split("&").forEach((pair) => {
            const [key, value] = pair.split("=");
            if (key && value) fragmentParams[key] = value;
          });

          console.log("Fragment params:", fragmentParams);

          // Store error information
          await AsyncStorage.setItem(
            "@reset_error",
            JSON.stringify({
              code: fragmentParams.error_code || fragmentParams.error || "unknown_error",
              message: fragmentParams.error_description || "Invalid or expired reset link",
            })
          );

          // Redirect to forgot-password
          router.replace("/(auth)/forgot-password");
          isProcessingDeepLink.current = false;
          return;
        }

        // Handle regular auth callbacks
        if (url.includes("auth/callback") || url.includes("auth/debug") || url.includes("/debug")) {
          console.log("Auth callback detected");
          const { data: { session } } = await supabase.auth.getSession();

          if (session?.user) {
            console.log("Valid session found in callback, redirecting to tabs");
            setSession(session);

            // Get the complete user profile
            const profile = await ProfileService.getProfile(session.user.id);

            // Use profile data if available, otherwise use basic auth info
            setUser(
              profile || {
                id: session.user.id,
                email: session.user.email,
                name: session.user.email?.split("@")[0] || "",
              }
            );

            router.replace("/(tabs)");
            isProcessingDeepLink.current = false;
            return;
          }
        }
        
        isProcessingDeepLink.current = false;
      } catch (error) {
        console.error("Error processing deep link:", error);
        // Store error information for display
        await AsyncStorage.setItem(
          "@reset_error",
          JSON.stringify({
            code: "processing_error",
            message: (error as Error).message || "Failed to process reset link",
          })
        );
        router.replace("/(auth)/forgot-password");
        isProcessingDeepLink.current = false;
      }
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, []);

  // Update the route protection logic
  useEffect(() => {
    if (isLoading) return;
    
    // Skip route protection if we're processing a deep link or during sign-in
    if (isProcessingDeepLink.current || isSigningIn) {
      console.log("Skipping route protection - auth action in progress");
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";

    // Check session from Supabase directly to avoid race conditions
    const checkSessionAndNavigate = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const hasValidSession = !!data.session;
        
        console.log("Route protection check: has valid session?", hasValidSession);
        
        if (!hasValidSession && !inAuthGroup) {
          console.log("No active session found, redirecting to login");
          router.replace("/(auth)/login");
        } else if (hasValidSession && inAuthGroup) {
          // If we're in auth group but have a session, go to tabs
          console.log("Valid session found while in auth group, redirecting to tabs");
          router.replace("/(tabs)");
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
    };
    
    checkSessionAndNavigate();
  }, [session, segments, isLoading, isSigningIn]);

  if (isLoading) {
    return null;
  }

  const commonStackOptions = {
    headerStyle: {
      backgroundColor: colorScheme === "dark" ? "#000" : "#fff",
    },
    headerShown: false,
    headerTintColor: colorScheme === "dark" ? "#fff" : "#000",
    headerShadowVisible: false,
  };

  return (
    <ThemeProvider>
      <StatusBar style="auto" />
      {!session ? (
        <Stack screenOptions={commonStackOptions}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="reset-callback" />
        </Stack>
      ) : (
        <Stack screenOptions={commonStackOptions}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen
            name="(chat)"
            options={{
              presentation: "fullScreenModal",
            }}
          />
          <Stack.Screen
            name="create-scenario"
            options={{
              presentation: "modal",
              title: "Create Scenario",
            }}
          />
        </Stack>
      )}
    </ThemeProvider>
  );
}