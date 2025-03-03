// app/_layout.tsx
import 'react-native-get-random-values';
import { useEffect, useState, useRef } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { useAppStore } from '@/hooks/useAppStore';
import * as Linking from 'expo-linking';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SubscriptionService } from '@/lib/services/subscription';
import Purchases from 'react-native-purchases';
Purchases.setLogLevel(Purchases.LOG_LEVEL.VERBOSE)

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const { setUser } = useAppStore();
  const authChangeHandled = useRef(false);

  // Initialize auth state
  useEffect(() => {
    //sync subscription services
    async function initServices() {
      try {
        await SubscriptionService.initialize();
        
        // Set up purchase listener for subscription changes
        const purchaseListener = Purchases.addCustomerInfoUpdateListener((info) => {
          const isPremium = info.entitlements.active['premium_access']?.isActive ?? false;
          if (typeof useAppStore.getState().setIsPremium === 'function') {
            useAppStore.getState().setIsPremium(isPremium);
            console.log('Subscription status updated:', isPremium);
          }
        });
        
        return () => {
          purchaseListener.remove();
        };
      } catch (error) {
        console.error('Error initializing services:', error);
      }
    }
    
    const initializeAuth = async () => {
      try {
        // Check for stored session
        const storedAuth = await AsyncStorage.getItem('supabase.auth.token');
        if (storedAuth) {
          const { access_token } = JSON.parse(storedAuth);
          if (access_token) {
            await supabase.auth.setSession({
              access_token,
              refresh_token: ''
            });
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        console.log('Initial session check:', session ? 'Has session' : 'No session');
        setSession(session);
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('Auth initialization error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    const cleanup = initServices();
    initializeAuth();
    
    return () => {
      cleanup.then(cleanupFn => cleanupFn && cleanupFn());
    };
  }, []);

  // Handle auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, session ? 'Has session' : 'No session');
      
      if (event === 'SIGNED_IN' && session && !authChangeHandled.current) {
        authChangeHandled.current = true;
        setSession(session);
        setUser(session.user);
        router.replace('/(tabs)');
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
        await AsyncStorage.removeItem('supabase.auth.token');
        router.replace('/(auth)/login');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Handle deep linking
  useEffect(() => {
    const handleDeepLink = async ({ url }: { url: string }) => {
      console.log('Deep link received:', url);
      
      if (url.includes('auth/callback') || url.includes('auth/debug')) {
        console.log('Auth callback detected');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          console.log('Valid session found in callback, redirecting to tabs');
          setSession(session);
          setUser(session.user);
          router.replace('/(tabs)');
        }
      }
    };

    const subscription = Linking.addEventListener('url', handleDeepLink);
    return () => {
      subscription.remove();
    };
  }, []);

  // Route protection
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    
    if (!session && !inAuthGroup) {
      console.log('No session, protecting route');
      router.replace('/(auth)/login');
    }
  }, [session, segments, isLoading]);

  if (isLoading) {
    return null;
  }

  const commonStackOptions = {
    headerStyle: {
      backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
    },
    headerShown: false,
    headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
    headerShadowVisible: false,
  };

  return !session ? (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="(auth)" />
    </Stack>
  ) : (
    <Stack screenOptions={commonStackOptions}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="(chat)"
        options={{
          presentation: 'fullScreenModal',
        }}
      />
      <Stack.Screen
        name="create-scenario"
        options={{
          presentation: 'modal',
          title: 'Create Scenario',
        }}
      />
    </Stack>
  );
}