// app/(auth)/reset-password.tsx
import { useState, useEffect } from 'react';
import {
  StyleSheet,
  Alert,
  View,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  BackHandler
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from '@/lib/supabase/client';
import { BackButton } from '@/components/ui/BackButton';
import { AuthService } from '@/lib/services/auth';
import { useTheme } from '@/lib/theme/theme';
import { Heading1, Heading2, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, { 
  FadeInDown, 
  FadeIn
} from "react-native-reanimated";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [validated, setValidated] = useState(false);
  const [validating, setValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isForceReset, setIsForceReset] = useState(false);
  const router = useRouter();
  const params = useLocalSearchParams();
  const theme = useTheme();
  
  console.log("Reset password screen mounted with params:", params);
  
  // Handle back button to prevent skipping password reset
  useEffect(() => {
    if (params.force_reset === 'true' || params.type === 'recovery') {
      setIsForceReset(true);
      
      // Prevent back button from skipping password reset
      const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
        Alert.alert(
          'Password Reset Required',
          'You must set a new password to continue.',
          [{ text: 'OK' }]
        );
        return true; // Prevent default back behavior
      });
      
      return () => backHandler.remove();
    }
  }, [params]);
  
  useEffect(() => {
    async function validateResetToken() {
      try {
        console.log("Validating reset token...");
        
        // Ensure we're still in password reset mode
        await AsyncStorage.setItem('@is_password_reset', 'true');
        
        // Check for error parameters
        if (params.error) {
          throw new Error(params.error_description as string || 'Invalid or expired reset link');
        }
        
        // First check if we already have a valid session
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          console.log("Existing session found, token is valid");
          
          // Store a flag indicating this is a password reset flow
          if (params.type === 'recovery') {
            await AsyncStorage.setItem('@is_password_reset', 'true');
          }
          
          setValidated(true);
          setValidating(false);
          return;
        }
        
        // Verify if we have the required parameters
        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;
        
        if (!accessToken) {
          console.log("No access token found in params");
          throw new Error('Invalid or missing reset token');
        }
        
        console.log("Access token found, attempting to validate");
        
        // Try to validate the recovery token
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || '',
        });
        
        if (error) {
          console.error("Error validating token:", error);
          throw error;
        }
        
        // Mark this as a password reset session
        await AsyncStorage.setItem('@is_password_reset', 'true');
        
        console.log("Token validated successfully");
        setValidated(true);
        
      } catch (error) {
        console.error('Error validating reset token:', error);
        setError((error as Error).message || 'Invalid or expired reset link');
        setValidated(false);
        
        // Store error for display on forgot-password screen
        await AsyncStorage.setItem('@reset_error', JSON.stringify({
          code: 'token_validation_error',
          message: (error as Error).message || 'Invalid or expired reset link'
        }));
      } finally {
        setValidating(false);
      }
    }
    
    validateResetToken();
  }, [params]);

  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get current user from session
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        throw new Error('Unable to verify your identity. Please try again.');
      }
      
      console.log("User found, updating password for:", user.id);
      
      // Use AuthService instead of direct Supabase call
      const { success, error: updateError } = await AuthService.updatePassword(
        user.id,
        password
      );
      
      if (!success || updateError) {
        throw new Error(updateError || 'Failed to update password');
      }
      
      console.log("Password updated successfully");
      
      // Clear the password reset flag - CRITICAL for proper flow
      await AsyncStorage.removeItem('@is_password_reset');
      
      // Sign out for security after password reset
      await supabase.auth.signOut();
      
      Alert.alert(
        'Success',
        'Your password has been reset successfully. Please sign in with your new password.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error) {
      console.error('Password update error:', error);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Custom back button handler to prevent skipping password reset
  const handleBackPress = () => {
    if (isForceReset) {
      Alert.alert(
        'Password Reset Required',
        'You must set a new password to continue.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    router.replace('/(auth)/login');
  };

  if (validating) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Animated.View entering={FadeIn}>
            <View style={styles.loadingIconContainer}>
              <Feather name="loader" size={36} color={theme.colors.primary.main} />
            </View>
            <Body1 style={styles.loadingText}>Validating your reset link...</Body1>
          </Animated.View>
        </View>
      </ThemedView>
    );
  }

  if (!validated) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorValidationContainer}>
          <Animated.View 
            style={styles.iconContainer}
            entering={FadeInDown.delay(100).springify()}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.error.light }]}>
              <Feather name="x" size={36} color={theme.colors.error.main} />
            </View>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(200).springify()}
          >
            <Heading2 style={styles.errorTitle}>
              Reset Link Invalid
            </Heading2>
            
            <Body1 style={styles.errorDescription}>
              {error || 'The password reset link is invalid or has expired.'}
            </Body1>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(300).springify()}
            style={styles.errorActionContainer}
          >
            <Button
              variant="primary"
              size="large"
              onPress={() => router.replace('/(auth)/forgot-password')}
            >
              Request New Reset Link
            </Button>
          </Animated.View>
        </View>
      </ThemedView>
    );
  }

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
            <BackButton onPress={handleBackPress} />
            <View style={{ flex: 1 }} /> {/* Spacer */}
          </View>
          
          <Animated.View 
            style={styles.iconContainer}
            entering={FadeInDown.delay(200).springify()}
          >
            <View style={styles.iconCircle}>
              <Feather name="lock" size={32} color={theme.colors.primary.main} />
            </View>
          </Animated.View>
          
          <Animated.View 
            entering={FadeInDown.delay(300).springify()}
            style={styles.contentCard}
          >
            <Card variant="elevated" style={styles.card}>
              <CardContent>
                <Heading2 style={styles.cardTitle}>Set New Password</Heading2>
                
                {error && (
                  <View style={styles.errorContainer}>
                    <Feather name="alert-circle" size={20} color={theme.colors.error.main} />
                    <Body2 color={theme.colors.error.main} style={styles.errorText}>
                      {error}
                    </Body2>
                  </View>
                )}
                
                <Body1 style={styles.instructions}>
                  Create a new password for your account. Choose a strong password that is 
                  at least 6 characters long.
                </Body1>
                
                <Input
                  label="New Password"
                  iconName="lock"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Enter new password"
                  containerStyle={styles.input}
                />
                
                <Input
                  label="Confirm Password"
                  iconName="check-circle"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  placeholder="Confirm new password"
                  containerStyle={styles.input}
                />
                
                <Caption style={styles.passwordHint}>
                  For better security, use a mix of letters, numbers, and special characters.
                </Caption>
                
                <Button
                  variant="primary"
                  size="large"
                  fullWidth
                  loading={loading}
                  disabled={loading || !password || !confirmPassword}
                  onPress={handleResetPassword}
                  style={styles.resetButton}
                >
                  Reset Password
                </Button>
              </CardContent>
            </Card>
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
  contentCard: {
    width: '100%',
    marginBottom: 32,
  },
  card: {
    width: '100%',
  },
  cardTitle: {
    textAlign: 'center',
    marginBottom: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    marginLeft: 8,
  },
  instructions: {
    textAlign: 'center',
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
  },
  passwordHint: {
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  resetButton: {
    marginBottom: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(46, 125, 50, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingText: {
    textAlign: 'center',
  },
  errorValidationContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#d32f2f',
  },
  errorDescription: {
    textAlign: 'center',
    marginBottom: 24,
    maxWidth: 300,
  },
  errorActionContainer: {
    width: '100%',
    maxWidth: 300,
  },
});