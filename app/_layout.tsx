// app/_layout.tsx
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

  // Check authentication state and redirect accordingly
  useEffect(() => {
    // Don't redirect when still loading
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
        // Reset any app state here if needed
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return null; // Or a loading screen
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
        },
        headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
        headerShadowVisible: false,
      }}
    >
      {!session ? (
        <Stack.Screen
          name="(auth)"
          options={{
            headerShown: false,
          }}
        />
      ) : (
        <>
          <Stack.Screen
            name="(tabs)"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="(chat)"
            options={{
              headerShown: false,
              presentation: 'fullScreenModal',
            }}
          />
          <Stack.Screen
            name="create-scenario"
            options={{
              presentation: 'modal',
              title: 'Create Scenario'
            }}
          />
        </>
      )}
    </Stack>
  );
}