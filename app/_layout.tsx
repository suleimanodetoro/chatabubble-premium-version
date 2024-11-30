// app/_layout.tsx
import { Stack } from 'expo-router';
import { useColorScheme } from '../hooks/useColorScheme';

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <Stack screenOptions={{
      headerStyle: {
        backgroundColor: colorScheme === 'dark' ? '#000' : '#fff',
      },
      headerTintColor: colorScheme === 'dark' ? '#fff' : '#000',
      headerBackTitle: "Back",
      headerShadowVisible: false,
    }}>
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false  // This hides the header for tab screens
        }} 
      />
      <Stack.Screen 
        name="(chat)/[id]" 
        options={{
          presentation: 'card',
          headerShown: true,
          headerBackTitle: "Back",
          title: "Chat"
        }}
      />
    </Stack>
  );
}