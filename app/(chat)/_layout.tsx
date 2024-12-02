// app/(chat)/_layout.tsx
import { Stack } from 'expo-router';
import { ChatProvider } from '../../contexts/ChatContext';

export default function ChatLayout() {
  return (
    <ChatProvider>
      <Stack>
        <Stack.Screen
          name="[id]"
          options={{
            title: "Chat",
            headerBackTitle: "Back",
          }}
        />
      </Stack>
    </ChatProvider>
  );
}