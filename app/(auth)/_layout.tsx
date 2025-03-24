// app/(auth)/_layout.tsx
import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';

export default function AuthLayout() {
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    console.log('Auth layout mounted, segments:', segments);
    // Force navigation to login if we're in the auth group but not on a specific screen
    if (segments.length === 1 && segments[0] === '(auth)') {
      console.log('Redirecting to login');
      router.replace('/(auth)/login');
    }
  }, [segments]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Sign In',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Create Account',
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Reset Password',
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          title: 'Set New Password',
        }}
      />
      <Stack.Screen
        name="reset-callback"
        options={{
          title: 'Password Reset',
        }}
      />
      <Stack.Screen
        name="debug"
        options={{
          title: 'Debug',
        }}
      />
    </Stack>
  );
}