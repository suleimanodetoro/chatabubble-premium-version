// components/ui/ChatBubble.tsx
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ChatMessage } from '@/types';

interface ChatBubbleProps {
  message: ChatMessage;
  showTranslation?: boolean;
}

export function ChatBubble({ message, showTranslation = true }: ChatBubbleProps) {
  const isUser = message.sender === 'user';
  
  const backgroundColor = useThemeColor(
    { light: isUser ? '#007AFF' : '#E9ECEF', dark: isUser ? '#0A84FF' : '#2C2C2E' },
    'background'
  );
  
  const textColor = useThemeColor(
    { light: isUser ? '#FFFFFF' : '#000000', dark: '#FFFFFF' },
    'text'
  );

  return (
    <View
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer,
        { backgroundColor }
      ]}
    >
      <ThemedText style={[styles.originalText, { color: textColor }]}>
        {message.content.original}
      </ThemedText>
      {showTranslation && (
        <ThemedText style={[styles.translatedText, { color: textColor, opacity: 0.8 }]}>
          {message.content.translated}
        </ThemedText>
      )}
      {message.isEdited && (
        <ThemedText style={[styles.editedText, { color: textColor, opacity: 0.6 }]}>
          edited
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  originalText: {
    fontSize: 16,
    marginBottom: 4,
  },
  translatedText: {
    fontSize: 14,
  },
  editedText: {
    fontSize: 12,
    marginTop: 4,
  },
});