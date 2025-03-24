//app/(auth)/forgot-password.tsx

import { useState, useEffect } from 'react';
import { StyleSheet, TextInput, Pressable, Alert, ActivityIndicator, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ThemedView } from '@/components/ThemedView';
import { ThemedText } from '@/components/ThemedText';
import { AuthService } from '@/lib/services/auth';
import { BackButton } from '@/components/ui/BackButton';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);
  const router = useRouter();

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

  console.log("Rendering forgot password screen. Error:", error, "Reset sent:", resetSent);

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <BackButton />
      </View>
      
      <ThemedText style={styles.title}>Reset Password</ThemedText>
      
      {error && (
        <View style={styles.errorContainer}>
          <ThemedText style={styles.errorTitle}>
            {error.code === 'otp_expired' ? 'Link Expired' : 'Error'}
          </ThemedText>
          <ThemedText style={styles.errorMessage}>{error.message}</ThemedText>
          <ThemedText style={styles.errorHint}>
            Please request a new password reset link below.
          </ThemedText>
        </View>
      )}
      
      {!resetSent ? (
        <>
          <ThemedText style={styles.instructions}>
            Enter your email address and we'll send you a link to reset your password.
          </ThemedText>
          
          <TextInput
            style={styles.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />
          
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleResetPassword}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <ThemedText style={styles.buttonText}>
                Send Reset Instructions
              </ThemedText>
            )}
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText style={styles.successMessage}>
            Password reset instructions have been sent to {email}.
          </ThemedText>
          
          <ThemedText style={styles.instructions}>
            Please check your email and follow the instructions to reset your password.
            The link in the email will expire in 1 hour.
          </ThemedText>
          
          <ThemedText style={styles.noteText}>
            Note: If you don't see the email in your inbox, please check your spam folder.
          </ThemedText>
          
          <Pressable
            style={styles.button}
            onPress={() => router.replace('/login')}
          >
            <ThemedText style={styles.buttonText}>
              Back to Login
            </ThemedText>
          </Pressable>
        </>
      )}
      
      <Link href="/login" asChild>
        <Pressable style={styles.linkButton}>
          <ThemedText style={styles.linkText}>
            Remember your password? Sign In
          </ThemedText>
        </Pressable>
      </Link>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  // Styles remain the same
  container: {
    flex: 1,
    padding: 20,
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
  noteText: {
    fontSize: 14,
    marginTop: 10,
    marginBottom: 20,
    textAlign: 'center',
    color: '#666',
    fontStyle: 'italic',
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
  linkButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 16,
  },
  successMessage: {
    fontSize: 18,
    marginBottom: 16,
    textAlign: 'center',
    color: '#28a745',
    fontWeight: '500',
  },
  errorContainer: {
    backgroundColor: '#fff8f8',
    borderWidth: 1,
    borderColor: '#ffcdd2',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#d32f2f',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 16,
    color: '#555',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});