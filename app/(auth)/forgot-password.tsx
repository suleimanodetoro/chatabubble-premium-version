// app/(auth)/forgot-password.tsx
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Alert,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  Text
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/lib/theme/theme';
import { AuthService } from '@/lib/services/auth';
import { BackButton } from '@/components/ui/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeInDown, 
  FadeIn
} from "react-native-reanimated";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const router = useRouter();
  const theme = useTheme();

  // Check for error message from deep link handling
  useEffect(() => {
    console.log("Forgot password screen mounted, checking for errors");
    
    const checkForErrors = async () => {
      try {
        const errorData = await AsyncStorage.getItem('@reset_error');
        console.log("Reset error data from storage:", errorData);
        
        if (errorData) {
          // Parse and display the error
          const resetError = JSON.parse(errorData);
          console.log("Found reset error:", resetError);
          setError(resetError);
          
          // Clear the error after displaying it
          await AsyncStorage.removeItem('@reset_error');
        }
      } catch (e) {
        console.error('Error checking for reset errors:', e);
      }
    };
    
    checkForErrors();
  }, []);

  const handleResetPassword = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await AuthService.resetPassword(email);
      setResetSent(true);
    } catch (error) {
      console.error('Password reset error:', error);
      setError({
        code: 'reset_request_failed',
        message: (error as Error).message
      });
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
          <View style={styles.headerRow}>
            <BackButton />
            <View style={{ flex: 1 }} />
          </View>
          
          <Animated.View 
            style={styles.iconContainer}
            entering={FadeInDown.delay(200).springify()}
          >
            <View style={styles.iconCircle}>
              <Feather 
                name={resetSent ? "check" : "key"} 
                size={32} 
                color={theme.colors.primary.main} 
              />
            </View>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(300).springify()}
            style={styles.contentContainer}
          >
            <Text style={styles.title}>
              {resetSent ? 'Check Your Email' : 'Reset Password'}
            </Text>
            
            {error && (
              <View style={styles.errorContainer}>
                <Feather name="alert-circle" size={20} color={theme.colors.error.main} />
                <Text style={styles.errorText}>
                  {error.message}
                </Text>
              </View>
            )}
            
            {!resetSent ? (
              <>
                <Text style={styles.instructions}>
                  Enter your email address and we'll send you a link to reset your password.
                </Text>
                
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Email Address"
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    placeholderTextColor="#A3A3A3"
                  />
                </View>
                
                <TouchableOpacity
                  style={[
                    styles.resetButton, 
                    loading && styles.resetButtonDisabled
                  ]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <Text style={styles.resetButtonText}>
                    {loading ? "Sending..." : "Send Reset Link"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.successMessage}>
                  We've sent a password reset link to:
                </Text>
                
                <Text style={styles.emailDisplay}>
                  {email}
                </Text>
                
                <Text style={styles.instructions}>
                  Please check your email and follow the instructions to reset your password.
                  The link will expire in 1 hour.
                </Text>
                
                <Text style={styles.noteText}>
                  Note: If you don't see the email in your inbox, please check your spam folder.
                </Text>
                
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => router.replace('/login')}
                >
                  <Text style={styles.backButtonText}>
                    Back to Login
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
          
          <Animated.View 
            entering={FadeIn.delay(400)}
            style={styles.footer}
          >
            <Link href="/login" asChild>
              <TouchableOpacity style={styles.loginLink}>
                <Text style={styles.loginLinkText}>
                  Return to Login
                </Text>
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
    backgroundColor: "#fff",
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(46, 125, 50, 0.1)", // Using primary color with opacity
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    width: '100%',
    marginBottom: 32,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
    color: '#333',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
    color: '#EF4444',
    fontSize: 14,
  },
  instructions: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 16,
    color: '#666',
  },
  inputContainer: {
    width: '100%',
    marginBottom: 24,
  },
  input: {
    height: 50,
    width: "100%",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
    fontSize: 16,
    color: "#333",
  },
  resetButton: {
    backgroundColor: "#2E7D32", // Green
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    width: '100%',
  },
  resetButtonDisabled: {
    opacity: 0.7,
  },
  resetButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  successMessage: {
    textAlign: 'center',
    marginBottom: 12,
    fontSize: 16,
    color: '#666',
  },
  emailDisplay: {
    textAlign: 'center',
    marginBottom: 24,
    fontSize: 18,
    fontWeight: '600',
    color: '#2E7D32', // Primary color
  },
  noteText: {
    textAlign: 'center',
    fontStyle: 'italic',
    marginBottom: 24,
    fontSize: 14,
    color: '#666',
  },
  backButton: {
    backgroundColor: "#2E7D32", // Green
    height: 50,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    width: '100%',
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  footer: {
    alignItems: 'center',
  },
  loginLink: {
    padding: 12,
  },
  loginLinkText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#2E7D32", // Green
  },
});