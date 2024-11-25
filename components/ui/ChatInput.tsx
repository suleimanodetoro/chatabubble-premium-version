// components/ui/ChatInput.tsx
import { useState } from 'react';
import { StyleSheet, TextInput, Pressable, View } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import * as Haptics from 'expo-haptics';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = 'Type a message...' }: ChatInputProps) {
  const [message, setMessage] = useState('');
  
  const backgroundColor = useThemeColor(
    { light: '#F2F2F7', dark: '#1C1C1E' },
    'background'
  );
  
  const textColor = useThemeColor(
    { light: '#000000', dark: '#FFFFFF' },
    'text'
  );
  
  const placeholderColor = useThemeColor(
    { light: '#8E8E93', dark: '#636366' },
    'tabIconDefault'
  );

  const tintColor = useThemeColor({}, 'tint');

  const handleSend = () => {
    if (message.trim()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSend(message.trim());
      setMessage('');
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, { backgroundColor, color: textColor }]}
        value={message}
        onChangeText={setMessage}
        placeholder={placeholder}
        placeholderTextColor={placeholderColor}
        multiline
        maxLength={500}
      />
      <Pressable
        onPress={handleSend}
        style={({ pressed }) => [
          styles.sendButton,
          { opacity: pressed ? 0.7 : 1 }
        ]}
      >
        <ThemedText style={[styles.sendButtonText, { color: tintColor }]}>
          Send
        </ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    marginLeft: 8,
    padding: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
