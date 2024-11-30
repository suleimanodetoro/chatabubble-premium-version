// components/ui/ChatInput.tsx
import { useState } from 'react';
import { StyleSheet, TextInput, Pressable, View, Platform } from 'react-native';
import { ThemedText } from '../ThemedText';

interface Props {
  onSend: (message: string) => void;
  isLoading?: boolean;
}

export function ChatInput({ onSend, isLoading }: Props) {
  const [text, setText] = useState('');

  const handleSend = () => {
    if (!text.trim() || isLoading) return;
    onSend(text);
    setText('');
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        multiline={false} // Changed to false
        maxLength={1000}
        returnKeyType="send" // Added
        enablesReturnKeyAutomatically={true} // Added
        onSubmitEditing={handleSend} // Added
        blurOnSubmit={false} // Added
      />
      <Pressable 
        onPress={handleSend}
        style={[
          styles.sendButton,
          (!text.trim() || isLoading) && styles.sendButtonDisabled
        ]}
      >
        <ThemedText style={styles.sendButtonText}>Send</ThemedText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#ccc',
    backgroundColor: '#fff',
    paddingBottom: Platform.OS === 'ios' ? 30 : 8,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f2f2f7',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});