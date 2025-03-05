// app/reset-callback.tsx - Root level file for handling reset callbacks
import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase/client';

export default function ResetCallbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [message, setMessage] = useState('Processing your password reset...');

  console.log("Reset callback screen mounted with params:", params);

  useEffect(() => {
    let mounted = true;

    const processCallback = async () => {
      try {
        // Parse URL hash fragment from URL params if present
        const accessToken = params.access_token as string;
        const refreshToken = params.refresh_token as string;
        const type = params.type as string;
        const error = params.error as string;
        const errorCode = params.error_code as string;
        const errorDescription = params.error_description as string;

        console.log("Processing callback with:", { 
          hasAccessToken: !!accessToken,
          hasError: !!error || !!errorCode,
          type
        });

        // Check for error parameters
        if (error || errorCode) {
          console.log('Error parameters detected in reset callback');
          
          // Store error information
          await AsyncStorage.setItem('@reset_error', JSON.stringify({
            code: errorCode || error || 'unknown_error',
            message: errorDescription || 'Invalid or expired reset link'
          }));
          
          if (mounted) {
            setMessage('Redirecting to password reset page...');
            // Short delay to show message
            setTimeout(() => {
              router.replace("/(auth)/forgot-password");
            }, 1000);
          }
          return;
        }
        
        // For valid tokens, try to set the session
        if (accessToken) {
          if (mounted) setMessage('Validating your reset token...');
          
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || ''
          });
          
          if (sessionError) {
            console.error('Error setting session:', sessionError);
            await AsyncStorage.setItem('@reset_error', JSON.stringify({
              code: 'session_error',
              message: sessionError.message || 'Failed to validate reset token'
            }));
            
            if (mounted) {
              setMessage('Error validating token. Redirecting...');
              setTimeout(() => {
                router.replace("/(auth)/forgot-password");
              }, 1000);
            }
            return;
          }
          
          // Valid session established
          console.log('Session established successfully');
          
          if (mounted) {
            setMessage('Redirecting to password reset screen...');
            // Short delay to show message
            setTimeout(() => {
              router.replace({
                pathname: "/(auth)/reset-password",
                params: {
                  access_token: accessToken,
                  refresh_token: refreshToken || '',
                  type: type || 'recovery'
                }
              });
            }, 1000);
          }
          return;
        }
        
        // If no access token or error, something else is wrong
        console.log('No access token or error found in params');
        await AsyncStorage.setItem('@reset_error', JSON.stringify({
          code: 'invalid_params',
          message: 'Invalid password reset link'
        }));
        
        if (mounted) {
          setMessage('Invalid reset link. Redirecting...');
          setTimeout(() => {
            router.replace("/(auth)/forgot-password");
          }, 1000);
        }
      } catch (error) {
        console.error('Error in reset callback:', error);
        
        // Store error information
        await AsyncStorage.setItem('@reset_error', JSON.stringify({
          code: 'processing_error',
          message: (error as Error).message || 'Failed to process reset link'
        }));
        
        if (mounted) {
          setMessage('Error processing reset link. Redirecting...');
          setTimeout(() => {
            router.replace("/(auth)/forgot-password");
          }, 1000);
        }
      }
    };

    // Add a slight delay to ensure the screen is mounted
    setTimeout(() => {
      processCallback();
    }, 500);

    return () => {
      mounted = false;
    };
  }, [params, router]);

  return (
    <>
      <Stack.Screen options={{ title: 'Password Reset' }} />
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <ThemedText style={styles.text}>{message}</ThemedText>
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  text: {
    marginTop: 20,
    fontSize: 16,
    textAlign: 'center',
  },
});