// googleone/app/(auth)/login.tsx
// Changes:
// 1. Imported Platform.
// 2. Modified ThemedView to pass theme.colors.background.default (a light color)
//    to *both* lightColor and darkColor props. This forces a light background
//    regardless of the system theme.
// 3. Conditionally rendered the Google Sign-In TouchableOpacity to hide it on iOS.

import { useState, useEffect } from "react";
import {
  StyleSheet,
  Alert,
  View,
  TouchableOpacity,
  Platform, // Imported Platform
  KeyboardAvoidingView,
  ScrollView,
  TextInput,
  Text
} from "react-native";
import { Link, useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/lib/theme/theme";
import { AuthService } from "@/lib/services/auth";
import { supabase } from "@/lib/supabase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from '@expo/vector-icons';
import { FontAwesome } from '@expo/vector-icons'; 
import Animated, { 
  FadeInDown,
  FadeIn
} from "react-native-reanimated";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const theme = useTheme(); // theme from lib/theme/theme.ts (static light colors)

  const handleAppleSignIn = async () => {
    try {
      setLoading(true);
      const user = await AuthService.signInWithApple();
      if (user) {
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.error("Apple sign in error:", error);
      Alert.alert("Error", "Failed to sign in with Apple");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
  
    setLoading(true);
    try {
      console.log("Attempting login with email:", email);
      
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session) {
        console.log("Found existing session, signing out first");
        await supabase.auth.signOut();
      }
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
  
      if (error) throw error;
      
      if (data.user) {
        console.log("Login successful for user:", data.user.id);
        
        setTimeout(() => {
          router.replace("/(tabs)");
        }, 500);
      } else {
        throw new Error("Login failed - no user returned");
      }
    } catch (error) {
      console.error("Login error:", error);
      Alert.alert("Error", (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      const user = await AuthService.signInWithGoogle();
      if (user) {
        router.replace("/(tabs)");
      }
    } catch (error) {
      console.error("Google sign in error:", error);
      Alert.alert("Error", "Failed to sign in with Google");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const testSupabaseSetup = async () => {
      console.log("Testing Supabase setup...");
      
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();
      console.log("Current session:", sessionData, "Error:", sessionError);
      
      try {
        await AsyncStorage.setItem("test-key", "test-value");
        const value = await AsyncStorage.getItem("test-key");
        console.log("AsyncStorage test:", value === "test-value" ? "working" : "failed");
      } catch (e) {
        console.log("AsyncStorage error:", e);
      }
    };
    
    testSupabaseSetup();
  }, []);

  return (
    // Forcing light background by passing the same light color to both lightColor and darkColor props
    <ThemedView 
      style={styles.container} 
      lightColor={theme.colors.background.default} 
      darkColor={theme.colors.background.default} // Ensures light background even in system dark mode
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View 
            style={styles.logoContainer}
            entering={FadeInDown.delay(200).springify()}
          >
            <View style={styles.logoCircle}>
              <Feather name="message-circle" size={40} color={theme.colors.primary.main} />
            </View>
            <Text style={styles.appName}>ChataBubble</Text>
            <Text style={styles.tagline}>Speak languages with confidence</Text>
          </Animated.View>
          
          <Animated.View
            entering={FadeInDown.delay(300).springify()}
            style={styles.formContainer}
          >
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholderTextColor="#A3A3A3"
              />
            </View>
            
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholderTextColor="#A3A3A3"
              />
            </View>
            
            <Link href="/forgot-password" asChild>
              <TouchableOpacity style={styles.forgotPasswordLink}>
                <Text style={styles.forgotPasswordText}>Forgot password?</Text>
              </TouchableOpacity>
            </Link>
            
            <TouchableOpacity
              style={[
                styles.signInButton, 
                loading && styles.signInButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={loading}
            >
              <Text style={styles.signInButtonText}>
                Sign In
              </Text>
            </TouchableOpacity>
          </Animated.View>
          
          <Animated.View
            entering={FadeInDown.delay(400).springify()}
            style={styles.dividerContainer}
          >
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </Animated.View>
          
          <Animated.View
            entering={FadeInDown.delay(500).springify()}
            style={styles.socialButtonsContainer}
          >
            {Platform.OS === "ios" && (
              <TouchableOpacity
                style={styles.appleButton}
                onPress={handleAppleSignIn}
                disabled={loading}
              >
                <FontAwesome name="apple" size={20} color="#FFFFFF" />
                <Text style={styles.appleButtonText}>Sign in with Apple</Text>
              </TouchableOpacity>
            )}
            
            {/* Conditionally render Google Sign-In button */}
            {Platform.OS !== 'ios' && (
              <TouchableOpacity
                style={styles.googleButton}
                onPress={handleGoogleSignIn}
                disabled={loading}
              >
                <View style={styles.googleIconContainer}>
                  <Text style={styles.googleIcon}>G</Text>
                </View>
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
          
          <Animated.View
            entering={FadeIn.delay(600)}
            style={styles.footer}
          >
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Link href="/register" asChild>
              <TouchableOpacity>
                <Text style={styles.createAccountText}>Create One</Text>
              </TouchableOpacity>
            </Link>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor is now handled by ThemedView's lightColor and darkColor props
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 40,
    paddingTop: 40,
    paddingBottom: 20,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F2F7F2", 
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: "600",
    color: "#333", // Light mode color
    marginBottom: 8,
    textAlign: "center",
  },
  tagline: {
    textAlign: "center",
    color: "#666", // Light mode color
    fontSize: 16,
  },
  formContainer: {
    width: "100%",
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    height: 50,
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0", // Light mode color
    fontSize: 16,
    color: "#333", // Light mode color
  },
  forgotPasswordText: {
    color: "#2E7D32", 
    fontSize: 16,
  },
  signInButton: {
    backgroundColor: "#2E7D32", 
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  signInButtonDisabled: {
    opacity: 0.7,
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 30,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E0E0E0", // Light mode color
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666", // Light mode color
    fontSize: 16,
  },
  socialButtonsContainer: {
    marginBottom: 30,
    gap: 16,
  },
  appleButton: {
    backgroundColor: "#000000",
    height: 50,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  appleButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  googleButton: {
    backgroundColor: "#FFFFFF",
    height: 50,
    borderRadius: 10,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0", // Light mode color
  },
  googleIconContainer: {
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  googleIcon: {
    color: "#EA4335", 
    fontSize: 18,
    fontWeight: "bold",
  },
  googleButtonText: {
    color: "#333333", // Light mode color
    fontSize: 16,
    fontWeight: "500",
    marginLeft: 8,
  },
  footerText: {
    fontSize: 16,
    color: "#666", // Light mode color
  },
  createAccountText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32", 
    marginLeft: 5,
  },
  // Styles that were already light-mode specific or neutral:
  forgotPasswordLink: {
    alignSelf: "flex-end",
    marginBottom: 24,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
});