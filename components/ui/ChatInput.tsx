// components/ui/ChatInput.tsx
import { useState, useCallback, memo } from 'react';
import { StyleSheet, TextInput, Pressable, View, Platform, Keyboard } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useChatContext } from '../../contexts/ChatContext';
import { useAppStore } from '../../hooks/useAppStore';
import { OpenAIService } from '../../lib/services/openai';
import { Language } from '../../types';

interface ChatInputProps {
  sessionLanguage: Language | null;
}

export const ChatInput = memo(function ChatInput({ sessionLanguage }: ChatInputProps) {
  const [inputText, setInputText] = useState('');
  const { state, dispatch } = useChatContext();
  const { currentScenario } = useAppStore();

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || state.isLoading || !currentScenario || !sessionLanguage) return;

    const trimmedText = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      const userMessage = {
        id: Date.now().toString(),
        content: {
          original: trimmedText,
          translated: 'Translating...',
        },
        sender: 'user',
        timestamp: Date.now(),
        isEdited: false,
      };

      // Add user message
      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

      console.log('Using language for translation:', sessionLanguage.name); // Debug log

      // Get translations and AI response in parallel
      const [translatedUserText, aiResponse] = await Promise.all([
        OpenAIService.translateText(trimmedText, sessionLanguage.name),
        OpenAIService.generateChatCompletion(
          [...state.messages, userMessage],
          currentScenario,
          sessionLanguage.name
        )
      ]);

      // Update user message
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: userMessage.id,
          message: {
            content: {
              original: trimmedText,
              translated: translatedUserText
            }
          }
        }
      });

      // Get AI translation
      const translatedAiResponse = await OpenAIService.translateText(aiResponse, 'English');

      // Add AI message
      dispatch({
        type: 'ADD_MESSAGE',
        payload: {
          id: Date.now().toString(),
          content: {
            original: aiResponse,
            translated: translatedAiResponse,
          },
          sender: 'assistant',
          timestamp: Date.now(),
          isEdited: false,
        }
      });
    } catch (error) {
      console.error('Message error:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [inputText, state.messages, currentScenario, sessionLanguage]);

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={inputText}
        onChangeText={setInputText}
        placeholder="Type a message..."
        placeholderTextColor="#999"
        maxLength={1000}
        editable={!state.isLoading}
        multiline
      />
      <Pressable
        onPress={handleSend}
        disabled={!inputText.trim() || state.isLoading}
        style={({ pressed }) => [
          styles.sendButton,
          (!inputText.trim() || state.isLoading) && styles.sendButtonDisabled,
          pressed && styles.sendButtonPressed
        ]}
      >
        <ThemedText style={styles.sendButtonText}>Send</ThemedText>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: '#f2f2f7',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    fontSize: 16,
  },
  sendButton: {
    height: 36,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonPressed: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});