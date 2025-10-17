// app/(auth)/debug.tsx
import { useEffect } from 'react';
import { View } from 'react-native';
import { Linking } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { supabase } from '@/lib/supabase/client';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ProfileService } from '@/lib/services/profile';
import { EncryptionService } from '@/lib/services/encryption';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function DebugScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  useEffect(() => {
    let mounted = true;
    let retryCount = 0;
    const MAX_RETRIES = 3;

    const checkSession = async () => {
      try {
        console.log('URL Params:', params);
        console.log('Current URL:', await Linking.getInitialURL());
        
        console.log('Debug screen mounted, attempt:', retryCount + 1);
        
        const { data: { session }, error } = await supabase.auth.getSession();
        console.log('Debug screen session check:', session ? 'Has session' : 'No session');
        
        if (error) throw error;

        if (!session && retryCount < MAX_RETRIES) {
          // If no session, wait briefly and retry
          retryCount++;
          setTimeout(checkSession, 1000);
          return;
        }

        if (session?.user) {
          try {
            // Check and log current profile state
            const profile = await ProfileService.getProfile(session.user.id);
            console.log('Current profile:', profile);
            
            if (!profile) {
              console.log('Creating new profile...');
              const newProfile = await ProfileService.setupProfile(session.user.id, session.user.email!);
              console.log('New profile created:', newProfile);
            }

            // Check encryption setup
            const keyStatus = await AsyncStorage.getItem(`@key_status:${session.user.id}`);
            if (!keyStatus) {
              console.log('Debug: Setting up encryption');
              await EncryptionService.generateUserKey(
                session.user.id,
                session.user.email!,
                'social'
              );
              await AsyncStorage.setItem(`@key_status:${session.user.id}`, 'generated');
            }

            if (mounted) {
              console.log('Debug: All setup complete, redirecting to tabs');
              router.replace('/(tabs)');
            }
          } catch (error) {
            console.error('Debug: Setup error:', error);
            if (mounted) router.replace('/(auth)/login');
          }
        } else {
          console.log('Debug: No session found, redirecting to login');
          if (mounted) router.replace('/(auth)/login');
        }
      } catch (error) {
        console.error('Unexpected error in debug screen:', error);
        if (mounted) router.replace('/(auth)/login');
      }
    };

    // Start the session check process
    checkSession();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ThemedText>Setting up your account...</ThemedText>
    </View>
  );
}