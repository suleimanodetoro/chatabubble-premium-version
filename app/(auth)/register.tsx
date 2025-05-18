// app/auth/register.tsx
import { useState } from 'react';
import {
  StyleSheet,
  Alert,
  View,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '@/lib/theme/theme';
import { AuthService } from '@/lib/services/auth';
import { AppleSignInButton } from "@/components/ui/AppleSignInButton";
import { GoogleSignInButton } from "@/components/ui/GoogleSignInButton";
import { Heading1, Heading2, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Feather } from '@expo/vector-icons';
import { ThemedView } from '@/components/ThemedView';
import Animated, { 
  FadeInDown, 
  FadeIn
} from "react-native-reanimated";

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const theme = useTheme();

  const validateForm = () => {
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return false;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return false;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return false;
    }

    // Password strength validation
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    setLoading(true);

    try {
      await AuthService.signUp(email, password);
      Alert.alert(
        'Registration Successful',
        'Please check your email for verification instructions.',
        [
          {
            text: 'OK',
            onPress: () => router.replace('/login'),
          },
        ]
      );
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Error', (error as Error).message);
    } finally {
      setLoading(false);
    }
  };

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

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View 
            style={styles.logoContainer}
            entering={FadeInDown.delay(200).springify()}
          >
            <View style={styles.logoCircle}>
              <Feather name="message-circle" size={40} color={theme.colors.primary.main} />
            </View>
            <Heading1 style={styles.appName}>ChataBubble</Heading1>
            <Body1 style={styles.tagline}>Create your account</Body1>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(300).springify()}
            style={styles.contentCard}
          >
            <Card variant="elevated" style={styles.card}>
              <CardContent>
                <Heading2 style={styles.cardTitle}>Sign Up</Heading2>
                
                <View style={styles.socialButtons}>
                  {Platform.OS === "ios" && (
                    <AppleSignInButton onPress={handleAppleSignIn} disabled={loading} />
                  )}
                  <GoogleSignInButton onPress={handleGoogleSignIn} disabled={loading} />
                </View>
                
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Caption style={styles.dividerText}>or with email</Caption>
                  <View style={styles.dividerLine} />
                </View>
                
                <Input
                  label="Email"
                  iconName="mail"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  placeholder="Enter your email"
                  containerStyle={styles.input}
                />
                
                <Input
                  label="Password"
                  iconName="lock"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Create a password"
                  hint="Must be at least 6 characters"
                  containerStyle={styles.input}
                />
                
                <Input
                  label="Confirm Password"
                  iconName="check-circle"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Confirm your password"
                  containerStyle={styles.input}
                />
                  
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={loading}
                  disabled={loading}
                  onPress={handleRegister}
                  style={styles.signUpButton}
                >
                  Create Account
                </Button>
              </CardContent>
            </Card>
          </Animated.View>
          
          <Animated.View 
            entering={FadeIn.delay(400)}
            style={styles.footer}
          >
            <Body1>Already have an account?</Body1>
            <Link href="/login" asChild>
              <TouchableOpacity style={styles.signInButton}>
                <Body1 weight="semibold" color={theme.colors.primary.main}>
                  Sign In
                </Body1>
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
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(46, 125, 50, 0.1)", // Using primary color with opacity
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  appName: {
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    textAlign: 'center',
    opacity: 0.8,
  },
  contentCard: {
    width: '100%',
    marginBottom: 24,
  },
  card: {
    width: '100%',
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  socialButtons: {
    marginBottom: 24,
    gap: 12,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#6B7280',
  },
  input: {
    marginBottom: 16,
  },
  signUpButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  signInButton: {
    marginLeft: 8,
    padding: 4,
  },
});