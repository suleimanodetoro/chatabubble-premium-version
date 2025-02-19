// app/(auth)/login.tsx
import { useState, useEffect } from "react";
import {
  StyleSheet,
  TextInput,
  Pressable,
  Alert,
  View,
  Platform,
} from "react-native";
import { Link, useRouter } from "expo-router";
import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { AuthService } from "@/lib/services/auth";
import { supabase } from "@/lib/supabase/client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppleSignInButton } from "@/components/ui/AppleSignInButton";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      const user = await AuthService.signIn(email, password);
      if (user) {
        router.replace("/(tabs)");
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

  // Add the test function
  const testSupabaseSetup = async () => {
    console.log("Testing Supabase setup...");

    // Test 1: Check current session
    const { data: sessionData, error: sessionError } =
      await supabase.auth.getSession();
    console.log("Current session:", sessionData, "Error:", sessionError);

    // Test 2: Check auth event subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(
        "Auth event:",
        event,
        "Session:",
        session ? "exists" : "null"
      );
    });

    // Test 3: Check storage persistence
    try {
      await AsyncStorage.setItem("test-key", "test-value");
      const value = await AsyncStorage.getItem("test-key");
      console.log(
        "AsyncStorage test:",
        value === "test-value" ? "working" : "failed"
      );
    } catch (e) {
      console.log("AsyncStorage error:", e);
    }
  };

  // Call the test function in useEffect
  useEffect(() => {
    testSupabaseSetup();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ThemedText style={styles.title}>Welcome Back</ThemedText>

      <View style={styles.socialButtons}>
        {Platform.OS === "ios" && (
          <AppleSignInButton onPress={handleAppleSignIn} disabled={loading} />
        )}
        <GoogleSignInButton onPress={handleGoogleSignIn} disabled={loading} />
      </View>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <ThemedText style={styles.dividerText}>or</ThemedText>
        <View style={styles.dividerLine} />
      </View>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleLogin}
        disabled={loading}
      >
        <ThemedText style={styles.buttonText}>
          {loading ? "Signing in..." : "Sign In"}
        </ThemedText>
      </Pressable>

      <Link href="/register" asChild>
        <Pressable style={styles.linkButton}>
          <ThemedText style={styles.linkText}>
            Don't have an account? Create one
          </ThemedText>
        </Pressable>
      </Link>

      <Link href="/forgot-password" asChild>
        <Pressable style={styles.linkButton}>
          <ThemedText style={styles.linkText}>Forgot password?</ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 32,
    textAlign: "center",
  },
  socialButtons: {
    marginBottom: 20,
    gap: 12,
  },
  socialButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e1e1e1",
  },
  googleButton: {
    backgroundColor: "#fff",
  },
  appleButton: {
    backgroundColor: "#000",
  },
  socialButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  appleButtonText: {
    color: "#fff",
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e1e1e1",
  },
  dividerText: {
    marginHorizontal: 10,
    color: "#666",
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ccc",
    marginBottom: 16,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
  },
  button: {
    backgroundColor: "#007AFF",
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#007AFF",
    fontSize: 16,
  },
});
