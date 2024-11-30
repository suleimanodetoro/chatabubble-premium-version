// app/(chat)/[id].tsx
import { useState, useCallback } from 'react';
import { StyleSheet, View, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useAppStore } from '../../hooks/useAppStore';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { ChatInput } from '../../components/ui/ChatInput';
import { ChatMessage } from '../../types';
import { OpenAIService } from '../../lib/services/openai';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { currentScenario, targetLanguage } = useAppStore();
  const insets = useSafeAreaInsets();

  const handleSendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !currentScenario || !targetLanguage) {
        Alert.alert('Error', 'Please select a scenario and target language first');
        return;
      }

      setIsLoading(true);

      try {
        const userMessage: ChatMessage = {
          id: Date.now().toString(),
          content: {
            original: text,
            translated: 'Translating...',
          },
          sender: 'user',
          timestamp: Date.now(),
          isEdited: false,
        };

        setMessages((prev) => [...prev, userMessage]);

        // Simulated translation logic
        const translatedText = await OpenAIService.translateText(text, targetLanguage.name);
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === userMessage.id
              ? { ...msg, content: { ...msg.content, translated: translatedText } }
              : msg
          )
        );

        const aiResponse = await OpenAIService.generateChatCompletion(
          [...messages, { ...userMessage, content: { ...userMessage.content, translated: translatedText } }],
          currentScenario,
          targetLanguage.name
        );

        const translatedResponse = await OpenAIService.translateText(aiResponse, 'English');

        const aiMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          content: {
            original: aiResponse,
            translated: translatedResponse,
          },
          sender: 'assistant',
          timestamp: Date.now(),
          isEdited: false,
        };

        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        Alert.alert('Error', error instanceof Error ? error.message : 'Failed to send message');
        setMessages((prev) =>
          prev.filter((msg) => msg.content.translated !== 'Translating...')
        );
      } finally {
        setIsLoading(false);
      }
    },
    [messages, currentScenario, targetLanguage]
  );

  return (
    <View style={styles.container}>
      <View style={styles.messagesContainer}>
        <FlashList
          data={messages}
          renderItem={({ item }) => <ChatBubble message={item} />}
          estimatedItemSize={80}
          contentContainerStyle={styles.messagesList}
        />
      </View>
      <View style={styles.inputContainer}>
        <ChatInput onSend={handleSendMessage} isLoading={isLoading} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
  },
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
});

