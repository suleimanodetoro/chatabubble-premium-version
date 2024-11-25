// app/(chat)/[id].tsx
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { ThemedView } from '../../components/ThemedView';
import { ThemedText } from '../../components/ThemedText';
import { useAppStore } from '../../hooks/useAppStore';
import { ChatMessage } from '../../types';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const currentScenario = useAppStore((state) => state.currentScenario);
  const currentSession = useAppStore((state) => state.currentSession);

  // Placeholder messages - replace with actual chat logic
  const messages: ChatMessage[] = [];

  const renderMessage = ({ item: message }: { item: ChatMessage }) => (
    <ThemedView style={[
      styles.messageBubble,
      message.sender === 'user' ? styles.userMessage : styles.assistantMessage
    ]}>
      <ThemedText style={styles.originalText}>{message.content.original}</ThemedText>
      <ThemedText style={styles.translatedText}>{message.content.translated}</ThemedText>
    </ThemedView>
  );

  useEffect(() => {
    if (currentScenario) {
      // Initialize chat session
      console.log('Starting chat for scenario:', currentScenario.title);
    }
  }, [currentScenario]);

  return (
    <ThemedView style={styles.container}>
      <FlashList
        data={messages}
        renderItem={renderMessage}
        estimatedItemSize={100}
        contentContainerStyle={styles.messageList}
      />
      
      {/* Add chat input here */}
      <ThemedView style={styles.inputContainer}>
        {/* Implement chat input */}
      </ThemedView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  messageList: {
    padding: 16,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9ECEF',
  },
  originalText: {
    fontSize: 16,
    marginBottom: 4,
  },
  translatedText: {
    fontSize: 14,
    opacity: 0.8,
  },
  inputContainer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});