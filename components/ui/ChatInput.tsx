// components/ui/ChatInput.tsx
import { useState, useCallback, memo } from 'react';
import { StyleSheet, TextInput, Pressable, View, Platform, Keyboard } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useChatContext } from '../../contexts/ChatContext';
import { useAppStore } from '../../hooks/useAppStore';
import { OpenAIService } from '../../lib/services/openai';
import { Language } from '../../types';
import { StorageService } from '../../lib/services/storage';
import { generateId } from '@/lib/utils/ids';

interface ChatInputProps {
  sessionLanguage: Language | null;
  disabled?: boolean;
}

export const ChatInput = memo(function ChatInput({ 
  sessionLanguage, 
  disabled = false 
}: ChatInputProps) {
  const [inputText, setInputText] = useState('');
  const { state, dispatch } = useChatContext();
  const { currentScenario, currentSession, setCurrentSession } = useAppStore();

  const handleSend = useCallback(async () => {
    if (!inputText.trim() || state.isLoading || !currentScenario || !sessionLanguage || disabled) {
      return;
    }

    const trimmedText = inputText.trim();
    setInputText('');
    Keyboard.dismiss();

    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Create user message
      const userMessage = {
        id: generateId(),
        content: {
          original: trimmedText,
          translated: 'Translating...',
        },
        sender: 'user',
        timestamp: Date.now(),
        isEdited: false,
      };

      dispatch({ type: 'ADD_MESSAGE', payload: userMessage });

      // Get translations and AI response in parallel
      const [translatedUserText, aiResponse] = await Promise.all([
        OpenAIService.translateText(trimmedText, sessionLanguage.name),
        OpenAIService.generateChatCompletion(
          [...state.messages, userMessage],
          currentScenario,
          sessionLanguage.name
        )
      ]);

      // Update user message with translation
      const updatedUserMessage = {
        ...userMessage,
        content: {
          original: trimmedText,
          translated: translatedUserText
        }
      };

      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: userMessage.id,
          message: updatedUserMessage
        }
      });

      // Create and add AI message
      const aiMessage = {
        id: generateId(),
        content: {
          original: aiResponse,
          translated: await OpenAIService.translateText(aiResponse, 'English')
        },
        sender: 'assistant',
        timestamp: Date.now(),
        isEdited: false,
      };

      dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });

      // Update session with new messages
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          messages: [...state.messages, updatedUserMessage, aiMessage],
          lastUpdated: Date.now(),
        };

        // Save to storage and update state
        await StorageService.saveSession(updatedSession);
        setCurrentSession(updatedSession);
      }

    } catch (error) {
      console.error('Message error:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [
    inputText, 
    state.messages, 
    currentScenario, 
    sessionLanguage, 
    currentSession, 
    dispatch, 
    setCurrentSession,
    disabled
  ]);

  return (
    <View style={styles.container}>
      <TextInput
        style={[styles.input, disabled && styles.inputDisabled]}
        value={inputText}
        onChangeText={setInputText}
        placeholder={disabled ? "Chat ended" : "Type a message..."}
        placeholderTextColor="#999"
        maxLength={1000}
        editable={!state.isLoading && !disabled}
        multiline
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />
      <Pressable
        onPress={handleSend}
        disabled={!inputText.trim() || state.isLoading || disabled}
        style={({ pressed }) => [
          styles.sendButton,
          (!inputText.trim() || state.isLoading || disabled) && styles.sendButtonDisabled,
          pressed && styles.sendButtonPressed
        ]}
      >
        <ThemedText style={styles.sendButtonText}>
          {state.isLoading ? '...' : 'Send'}
        </ThemedText>
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
    paddingBottom: Platform.OS === 'ios' ? 8 : 8,
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
  inputDisabled: {
    backgroundColor: '#F8F9FA',
    color: '#999',
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