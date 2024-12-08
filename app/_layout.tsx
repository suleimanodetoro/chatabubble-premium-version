// app/_layout.tsx
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { useRouter } from 'expo-router';
import { useColorScheme } from '@/hooks/useColorScheme';
import { supabase } from '@/lib/supabase/client';
import { Session } from '@supabase/supabase-js';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    console.log('Checking session...');
    
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Session check result:', session ? 'Has session' : 'No session');
      setSession(session);
      setIsLoading(false);
      
      // Explicitly redirect based on session
      if (!session) {
        console.log('Redirecting to login...');
        router.replace('/(auth)/login');
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log('Auth state changed:', _event, session ? 'Has session' : 'No session');
      setSession(session);
      
      // Redirect on auth state change
      if (!session) {
        router.replace('/(auth)/login');
      } else {
        router.replace('/(tabs)');
      }
    });

    return () => subscription.unsubscribe();
  }, [router]);

  if (isLoading) {
    return null;
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
      <Stack.Screen
        name="(auth)"
        options={{
          headerShown: false,
        }}
      />
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
    </Stack>
  );
}