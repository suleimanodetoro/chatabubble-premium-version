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
  const [initialRouteDetermined, setInitialRouteDetermined] = useState(false); // Track if initial route has been determined
  const router = useRouter();
  const segments = useSegments();
  const { setUser } = useAppStore();
  const authChangeHandled = useRef(false);
  const isProcessingDeepLink = useRef(false); // Track deep link processing
  const isPasswordReset = useRef(false); // Track password reset flow

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth state...');
        
        // Check if we're in a password reset flow
        const resetFlow = await AsyncStorage.getItem('@is_password_reset');
        if (resetFlow === 'true') {
          console.log('App is in password reset flow');
          isPasswordReset.current = true;
        }

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
        setInitialRouteDetermined(true); // Mark that initial route can be determined now
      }
    };

    initializeAuth();
  }, []);

  // Handle auth state changes
  useEffect(() => {
    console.log('Setting up auth state change handler...');
    
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

        // Check if this is a password reset flow
        const resetFlow = await AsyncStorage.getItem('@is_password_reset');
        if (resetFlow === 'true') {
          console.log('Detected password reset flow - NOT redirecting to tabs');
          isPasswordReset.current = true;
          setIsSigningIn(false);
          return; // Exit early to prevent redirect
        }

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

        // Check if user has completed onboarding
        console.log('Checking onboarding status after sign in');
        const hasCompletedOnboarding = await ProfileService.hasCompletedOnboarding(session.user.id);
        console.log('Onboarding status after sign in:', hasCompletedOnboarding ? 'Completed' : 'Not completed');

        // Add a small delay to ensure state is updated before navigation
        setTimeout(() => {
          console.log("Redirecting after successful sign-in");
          if (hasCompletedOnboarding) {
            router.replace("/(tabs)");
          } else {
            router.replace("/onboarding");
          }
          // Reset the sign-in flag after navigation
          setTimeout(() => {
            setIsSigningIn(false);
          }, 500);
        }, 500);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem("supabase.auth.token");
        await AsyncStorage.removeItem('@is_password_reset');
        isPasswordReset.current = false;
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
          
          // Mark this as a password reset flow BEFORE parsing token
          // This is critical to prevent the auth state change handler from redirecting
          await AsyncStorage.setItem('@is_password_reset', 'true');
          isPasswordReset.current = true;
          
          // Extract tokens from fragment
          const fragmentParams: Record<string, string> = {};
          fragment.split("&").forEach((pair) => {
            const [key, value] = pair.split("=");
            if (key && value) fragmentParams[key] = value;
          });
          
          // Navigate to the reset-callback screen with params
          console.log("Navigating to reset-callback with token");
          router.replace({
            pathname: "/(auth)/reset-callback",
            params: fragmentParams
          });
          
          isProcessingDeepLink.current = false;
          return;
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
            console.log("Valid session found in callback, checking onboarding status");
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

            // Check onboarding status before redirecting
            const hasCompletedOnboarding = await ProfileService.hasCompletedOnboarding(session.user.id);
            
            if (hasCompletedOnboarding) {
              console.log('User has completed onboarding, going to tabs');
              router.replace("/(tabs)");
            } else {
              console.log('User has not completed onboarding, going to onboarding');
              router.replace("/onboarding");
            }
            
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
    // Skip until we've determined the initial route
    if (isLoading || !initialRouteDetermined) {
      console.log('Skipping route protection - still loading or initial route not determined');
      return;
    }
    
    // Skip route protection if we're processing a deep link, during sign-in or password reset
    if (isProcessingDeepLink.current || isSigningIn || isPasswordReset.current) {
      console.log("Skipping route protection - auth action in progress or password reset");
      return;
    }

    const inAuthGroup = segments[0] === "(auth)";
    const inTabsGroup = segments[0] === "(tabs)";
    const onSplashScreen = segments[0] === "splash";
    const onOnboardingScreen = segments[0] === "onboarding";

    console.log('Current route segment:', segments[0]);
    
    // Check session from Supabase directly to avoid race conditions
    const checkSessionAndNavigate = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const hasValidSession = !!data.session;
        
        // Double check if this is a password reset flow
        const resetFlow = await AsyncStorage.getItem('@is_password_reset');
        if (resetFlow === 'true') {
          console.log('Skip route protection - in password reset flow');
          isPasswordReset.current = true;
          return;
        }
        
        console.log("Route protection check:", {
          hasValidSession,
          inAuthGroup,
          inTabsGroup,
          onSplashScreen,
          onOnboardingScreen
        });
        
        // Allow splash screen to handle its own routing
        if (onSplashScreen) {
          console.log('On splash screen, skipping route protection');
          return;
        }
        
        if (hasValidSession) {
          // Check if user has completed onboarding
          const hasCompletedOnboarding = data.session?.user 
            ? await ProfileService.hasCompletedOnboarding(data.session.user.id)
            : false;
          
          console.log('User authenticated, onboarding status:', hasCompletedOnboarding);
          
          if (inAuthGroup) {
            // If we're in auth group but have a session, redirect based on onboarding status
            console.log('In auth group with valid session, redirecting');
            if (hasCompletedOnboarding) {
              router.replace("/(tabs)");
            } else {
              router.replace("/onboarding");
            }
          } else if (onOnboardingScreen && hasCompletedOnboarding) {
            // User already completed onboarding but somehow got back there
            console.log('User has completed onboarding but is on onboarding screen, redirecting to tabs');
            router.replace("/(tabs)");
          } else if (inTabsGroup && !hasCompletedOnboarding) {
            // User hasn't completed onboarding but is trying to access tabs
            console.log('User has not completed onboarding but is on tabs, redirecting to onboarding');
            router.replace("/onboarding");
          }
        } else {
          // No valid session
          if (!inAuthGroup && !onSplashScreen) {
            console.log("No active session found, redirecting to login");
            router.replace("/(auth)/login");
          }
        }
      } catch (error) {
        console.error("Error checking session:", error);
      }
    };
    
    checkSessionAndNavigate();
  }, [segments, isLoading, isSigningIn, initialRouteDetermined]);

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
      <Stack screenOptions={commonStackOptions}>
        <Stack.Screen name="splash" options={{ animation: 'fade' }} />
        <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="(auth)" options={{ animation: 'slide_from_bottom' }} />
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen
          name="(chat)"
          options={{
            presentation: "fullScreenModal",
            animation: 'slide_from_right'
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
    </ThemeProvider>
  );
}