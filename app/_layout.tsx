// app/_layout.tsx
import 'react-native-get-random-values';
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter, useSegments } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';
import { useAppStore } from '@/hooks/useAppStore';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const segments = useSegments();
  const { setUser } = useAppStore();

  // Initialize and monitor auth state
  useEffect(() => {
    console.log('Checking session...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session check result:', session ? 'Has session' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session ? 'Has session' : 'No session');
      setSession(session);
      setUser(session?.user ?? null);
      
      if (!session) {
        // Optional: Reset any app state here if needed
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Redirect based on authentication state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inProtectedRoute = !inAuthGroup;

    if (!session && inProtectedRoute) {
      // No session but trying to access protected route
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      // Have session but still in auth group
      router.replace('/(tabs)');
    }
  }, [session, segments, isLoading]);

  if (isLoading) {
    return null; // Or a loading screen
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
