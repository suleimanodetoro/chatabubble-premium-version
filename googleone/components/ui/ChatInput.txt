// components/ui/ChatInput.tsx
import { useState, useCallback, memo } from "react";
import {
  StyleSheet,
  TextInput,
  Pressable,
  View,
  Platform,
  Keyboard,
  Alert,
} from "react-native";
import { ThemedText } from "../ThemedText";
import { useChatContext } from "../../contexts/ChatContext";
import { useAppStore } from "../../hooks/useAppStore";
import { OpenAIService } from "../../lib/services/openai";
import { Language, ChatMessage } from "../../types"; // Make sure ChatMessage is explicitly imported
import { StorageService } from "../../lib/services/storage";
import { generateId } from "@/lib/utils/ids";

interface ChatInputProps {
  sessionLanguage: Language | null;
  disabled?: boolean;
}

export const ChatInput = memo(function ChatInput({
  sessionLanguage,
  disabled = false,
}: ChatInputProps) {
  const [inputText, setInputText] = useState("");
  const { state, dispatch } = useChatContext();
  const { currentScenario, currentSession, setCurrentSession } = useAppStore();

  // In the main ChatScreen component:
const handleSend = useCallback(async (text: string) => {
    if (!currentSession || !currentScenario || !text.trim() || state.isLoading) return;
    
    try {
      // Create a new message
      const newMessage = {
        id: Date.now().toString(),
        content: {
          original: text,
          translated: 'Translating...',
        },
        sender: 'user' as const,
        timestamp: Date.now(),
        isEdited: false,
      };
      
      // Add to context and set loading state
      dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // Process the message - using import without dynamic import
      const OpenAIService = require('@/lib/services/openai').OpenAIService;
      
      // Translate user message
      const translatedUserText = await OpenAIService.translateText(
        text,
        currentSession.target_language.name
      );
      
      // Update user message with translation
      const updatedUserMessage = {
        ...newMessage,
        content: {
          original: text,
          translated: translatedUserText,
        },
      };
      
      dispatch({
        type: 'UPDATE_MESSAGE',
        payload: {
          id: newMessage.id,
          message: updatedUserMessage,
        },
      });
      
      // Get AI response
      const aiResponse = await OpenAIService.generateChatCompletion(
        [...state.messages, updatedUserMessage],
        currentScenario,
        currentSession.target_language.name
      );
      
      // Translate AI response to English
      const translatedAiResponse = await OpenAIService.translateText(
        aiResponse,
        "English"
      );
      
      // Create and add AI message
      const aiMessage = {
        id: Date.now().toString() + '-ai',
        content: {
          original: aiResponse,
          translated: translatedAiResponse,
        },
        sender: 'assistant' as const,
        timestamp: Date.now(),
        isEdited: false,
      };
      
      dispatch({ type: 'ADD_MESSAGE', payload: aiMessage });
      
      // Update session
      if (currentSession) {
        const updatedSession = {
          ...currentSession,
          messages: [...state.messages, updatedUserMessage, aiMessage],
          lastUpdated: Date.now(),
        };
        
        await StorageService.saveSession(updatedSession);
        setCurrentSession(updatedSession);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      // IMPORTANT: Always reset loading state
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [currentSession, currentScenario, state.messages, state.isLoading, dispatch, setCurrentSession]);

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
          (!inputText.trim() || state.isLoading || disabled) &&
            styles.sendButtonDisabled,
          pressed && styles.sendButtonPressed,
        ]}
      >
        <ThemedText style={styles.sendButtonText}>
          {state.isLoading ? "..." : "Send"}
        </ThemedText>
      </Pressable>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 8 : 8,
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    maxHeight: 100,
    minHeight: 40,
    backgroundColor: "#f2f2f7",
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 8,
    fontSize: 16,
  },
  inputDisabled: {
    backgroundColor: "#F8F9FA",
    color: "#999",
  },
  sendButton: {
    height: 36,
    paddingHorizontal: 16,
    backgroundColor: "#007AFF",
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonPressed: {
    opacity: 0.7,
  },
  sendButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});