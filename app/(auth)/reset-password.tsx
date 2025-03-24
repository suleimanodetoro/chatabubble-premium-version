// app/(auth)/reset-password.tsx
import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, View, BackHandler } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/lib/supabase/client';
import { BackButton } from '@/components/ui/BackButton';
import { AuthService } from '@/lib/services/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      
      // Use AuthService instead of direct Supabase call - this is the key fix
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
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.loadingText}>Validating your reset link...</ThemedText>
      </ThemedView>
    );
  }

  if (!validated) {
    return (
      <ThemedView style={[styles.container, styles.centerContent]}>
        <ThemedText style={styles.errorIcon}>❌</ThemedText>
        <ThemedText style={styles.errorTitle}>
          Reset Link Invalid
        </ThemedText>
        <ThemedText style={styles.errorText}>
          {error || 'The password reset link is invalid or has expired.'}
        </ThemedText>
        <Pressable
          style={styles.button}
          onPress={() => router.replace('/(auth)/forgot-password')}
        >
          <ThemedText style={styles.buttonText}>
            Request New Reset Link
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <BackButton onPress={handleBackPress} />
      </View>
      
      <ThemedText style={styles.title}>Set New Password</ThemedText>
      
      {error && (
        <View style={styles.errorAlert}>
          <ThemedText style={styles.errorAlertText}>{error}</ThemedText>
        </View>
      )}
      
      <ThemedText style={styles.instructions}>
        Enter your new password below. Choose a strong password that is at least 6 characters.
      </ThemedText>
      
      <TextInput
        style={styles.input}
        placeholder="New Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        editable={!loading}
      />
      
      <TextInput
        style={styles.input}
        placeholder="Confirm New Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        editable={!loading}
      />
      
      <ThemedText style={styles.passwordHint}>
        Your password should be at least 6 characters and include a mix of letters, numbers, and symbols for best security.
      </ThemedText>
      
      <Pressable
        style={[styles.button, loading && styles.buttonDisabled]}
        onPress={handleResetPassword}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <ThemedText style={styles.buttonText}>
            Reset Password
          </ThemedText>
        )}
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginTop: 20,
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  instructions: {
    fontSize: 16,
    marginBottom: 24,
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  input: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    marginBottom: 20,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#007AFF',
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  errorIcon: {
    fontSize: 50,
    marginBottom: 20,
  },
  errorAlert: {
    backgroundColor: '#ffebee',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  errorAlertText: {
    color: '#d32f2f',
    textAlign: 'center',
  },
  passwordHint: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginBottom: 20,
    textAlign: 'center',
  },
});