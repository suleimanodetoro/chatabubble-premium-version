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
// *** ADDED IMPORT ***
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [initialRouteDetermined, setInitialRouteDetermined] = useState(false);
  const router = useRouter();
  const segments = useSegments();
  const { setUser } = useAppStore();
  const authChangeHandled = useRef(false);
  const isProcessingDeepLink = useRef(false);
  const isPasswordReset = useRef(false);

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
          session ? 
 "Has session" : "No session" 
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
        setInitialRouteDetermined(true); 
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

  // === MODIFIED Route Protection Logic ===
  useEffect(() => {
    // Skip protection until loading/initialization is complete
    if (isLoading || !initialRouteDetermined) {
      console.log('Skipping route protection - still loading or initial route not determined');
      return;
    }

    // Skip protection during specific auth flows
    if (isProcessingDeepLink.current || isSigningIn || isPasswordReset.current) {
      console.log("Skipping route protection - auth action in progress or password reset");
      return;
    }

    // Identify current location
    const currentSegment = segments[0] || null;
    const inAuthGroup = currentSegment === "(auth)";
    const inTabsGroup = currentSegment === "(tabs)";
    const inChatGroup = currentSegment === "(chat)";
    const onSplashScreen = currentSegment === "splash";
    const onOnboardingScreen = currentSegment === "onboarding";
    // Check if user is navigating within the main authenticated parts of the app
    const isWithinApp = inTabsGroup || inChatGroup;

    console.log('Current route segment:', currentSegment);

    const checkSessionAndNavigate = async () => {
      try {
        // Check session status directly
        const { data: sessionData } = await supabase.auth.getSession();
        const hasValidSession = !!sessionData.session;
        const userId = sessionData.session?.user?.id;

        // --- START: Optimization for Authenticated Users ---
        if (hasValidSession && userId && isWithinApp) {
          // If user is logged in and already inside tabs or chat,
          // we primarily only need to worry if they haven't completed onboarding.
          const isOnboardingComplete = await ProfileService.hasCompletedOnboarding(userId);
          if (isOnboardingComplete) {
            // User is authenticated, onboarded, and inside app. Usually no redirect needed.
            console.log('Route Protection: User authenticated, onboarded, and inside app. Skipping further checks.');
            return; // **** EXIT EARLY ****
          } else if (!onOnboardingScreen) {
            // User is authenticated but hasn't onboarded, and isn't on the onboarding screen.
            console.log('Route Protection: User authenticated but onboarding incomplete. Redirecting to onboarding.');
            router.replace("/onboarding");
            return; // Redirected
          }
          // If user is authenticated, not onboarded, but *is* on the onboarding screen, let them stay.
        }
        // --- END: Optimization ---


        // --- Original Checks (Run if not optimized out or session is invalid) ---

        // Check if explicitly in password reset flow (important to check again here)
        const resetFlow = await AsyncStorage.getItem('@is_password_reset');
        if (resetFlow === 'true') {
          console.log('Skip route protection - in password reset flow');
          isPasswordReset.current = true; // Ensure flag is set
          return;
        }

        // Log the state being checked
        console.log("Route protection check running full checks:", {
          hasValidSession,
          userId: userId || 'N/A',
          inAuthGroup,
          inTabsGroup,
          inChatGroup,
          onSplashScreen,
          onOnboardingScreen
        });

        // Allow splash screen
        if (onSplashScreen) {
          console.log('On splash screen, skipping further route protection');
          return;
        }

        // Logic based on session validity
        if (hasValidSession && userId) {
          const hasCompletedOnboarding = await ProfileService.hasCompletedOnboarding(userId);
          console.log('User authenticated, onboarding status:', hasCompletedOnboarding);

          if (inAuthGroup) {
            // Signed in, but on auth screen -> Redirect into app
            console.log('In auth group with valid session, redirecting');
            router.replace(hasCompletedOnboarding ? "/(tabs)" : "/onboarding");
          } else if (onOnboardingScreen && hasCompletedOnboarding) {
            // Signed in, completed onboarding, but on onboarding screen -> Redirect to tabs
            console.log('User has completed onboarding but is on onboarding screen, redirecting to tabs');
            router.replace("/(tabs)");
          }
          // Note: The case of being inTabs/inChat without onboarding is handled by the optimization block above.

        } else { // No valid session
          // Not signed in, redirect to login unless already in auth group or splash
          if (!inAuthGroup && !onSplashScreen) {
            console.log("No active session found, redirecting to login");
            router.replace("/(auth)/login");
          }
        }
      } catch (error) {
        console.error("Error during route protection session check:", error);
        // Fallback? Maybe redirect to login on error?
        if (!inAuthGroup && !onSplashScreen) {
             router.replace("/(auth)/login");
        }
      }
    };

    checkSessionAndNavigate();
    // Keep original dependencies - the effect needs to re-run when segments change or auth state potentially changes
  }, [segments, isLoading, isSigningIn, initialRouteDetermined, router]); // Added router to dependencies as it's used inside

  if (isLoading) {
    return null; 
  } 

  const commonStackOptions = { 
    headerStyle: { 
      backgroundColor: colorScheme === "dark" ? 
 "#000" : "#fff", 
    },
    headerShown: false, 
    headerTintColor: colorScheme === "dark" ? 
 "#fff" : "#000", 
    headerShadowVisible: false, 
  };
  return ( 
    // *** WRAP WITH SafeAreaProvider ***
    <SafeAreaProvider>
        <ThemeProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={commonStackOptions}>
            <Stack.Screen name="splash" options={{ animation: 'fade' }} />
            <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
            <Stack.Screen name="(auth)" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen
            name="(chat)" 
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
    </SafeAreaProvider>
  ); 
}