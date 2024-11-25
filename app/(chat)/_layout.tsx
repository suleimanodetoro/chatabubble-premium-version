// app/(chat)/_layout.tsx
import { Stack } from 'expo-router';

export default function ChatLayout() {
  return (
    <Stack>
      <Stack.Screen
        name="[id]"
        options={{
          title: "Chat",
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}