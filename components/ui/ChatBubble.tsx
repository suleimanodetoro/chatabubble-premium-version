// components/ui/ChatBubble.tsx
import React, { memo, useCallback, useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ChatMessage } from "@/types";
import { useChatContext } from "../../contexts/ChatContext";
import { OpenAIService } from "../../lib/services/openai";
import { useAppStore } from "../../hooks/useAppStore";
import { SpeechService } from "@/lib/services/speech";
import { Ionicons } from '@expo/vector-icons';
import { generateId } from '@/lib/utils/ids';
import { StorageService } from '@/lib/services/storage';

export const ChatBubble = memo(function ChatBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const { state, dispatch } = useChatContext();
  const sourceLanguage = useAppStore((state) => state.sourceLanguage);
  const currentSession = useAppStore((state) => state.currentSession);
  const targetLanguage = useAppStore((state) => state.targetLanguage);
  const currentScenario = useAppStore((state) => state.currentScenario);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.sender === "user";

  useEffect(() => {
    return () => {
      if (isSpeaking) {
        SpeechService.stop();
      }
    };
  }, [isSpeaking]);

  const handleSpeak = useCallback(async () => {
    if (isSpeaking) {
      await handleStop();
      return;
    }

    try {
      const textToSpeak = message.content.original;
      const languageToSpeak = isUser ? sourceLanguage : currentSession?.targetLanguage;

      if (!languageToSpeak) {
        console.error("No language available for speech");
        return;
      }

      setIsSpeaking(true);
      await SpeechService.speak(textToSpeak, languageToSpeak);
    } catch (error) {
      console.error("Speech error:", error);
      Alert.alert("Speech Error", "Unable to play speech. Please try again.");
    } finally {
      setIsSpeaking(false);
    }
  }, [message.content.original, isUser, sourceLanguage, currentSession?.targetLanguage, isSpeaking]);

  const handleStop = useCallback(async () => {
    try {
      await SpeechService.stop();
    } finally {
      setIsSpeaking(false);
    }
  }, []);

  const handleEdit = useCallback(
    async (editType: "original" | "translation") => {
      if (!targetLanguage || !currentScenario) {
        console.log('Missing targetLanguage or currentScenario:', { targetLanguage, currentScenario });
        return;
      }

      const textToEdit =
        editType === "original" ? message.content.original : message.content.translated;

      Alert.prompt(
        "Edit Message",
        `Edit ${editType === "original" ? "message" : "translation"}:`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Save",
            onPress: async (newText?: string) => {
              if (!newText?.trim()) return;

              dispatch({ type: "SET_LOADING", payload: true });

              try {
                // Get the index of the current message
                const messageIndex = state.messages.findIndex(m => m.id === message.id);
                if (messageIndex === -1) return;

                let updatedMessage;

                if (message.sender === 'assistant') {
                  if (editType === 'translation') {
                    // If editing English translation of AI message, translate to target language
                    const newOriginal = await OpenAIService.translateText(
                      newText,
                      targetLanguage.name
                    );
                    updatedMessage = {
                      ...message,
                      content: {
                        original: newOriginal,  // New translated target language
                        translated: newText,    // User's edited English
                      },
                      isEdited: true,
                    };
                  } else {
                    // If editing target language of AI message, translate to English
                    const newTranslation = await OpenAIService.translateText(
                      newText,
                      'English'
                    );
                    updatedMessage = {
                      ...message,
                      content: {
                        original: newText,        // User's edited target language
                        translated: newTranslation, // New English translation
                      },
                      isEdited: true,
                    };
                  }
                } else {
                  // Original user message handling
                  const translationResult = await OpenAIService.translateText(
                    newText,
                    editType === "original" ? targetLanguage.name : "English"
                  );

                  updatedMessage = {
                    ...message,
                    content: {
                      original: editType === "original" ? newText : translationResult,
                      translated: editType === "original" ? translationResult : newText,
                    },
                    isEdited: true,
                  };
                }

                // Update messages list
                const newMessageList = state.messages.slice(0, messageIndex + 1);
                newMessageList[messageIndex] = updatedMessage;

                // Dispatch update
                dispatch({
                  type: 'LOAD_MESSAGES',
                  payload: newMessageList
                });

                // Save the updated messages to storage
                if (currentSession) {
                  const updatedSession = {
                    ...currentSession,
                    messages: newMessageList,
                    lastUpdated: Date.now(),
                  };
                  await StorageService.saveSession(updatedSession);
                  setCurrentSession(updatedSession);
                }

                // Only generate new AI response for user message edits
                if (message.sender === 'user') {
                  const aiResponse = await OpenAIService.generateChatCompletion(
                    newMessageList,
                    currentScenario,
                    targetLanguage.name
                  );

                  const translatedResponse = await OpenAIService.translateText(
                    aiResponse,
                    'English'
                  );

                  const newAiMessage = {
                    id: generateId(),
                    content: {
                      original: aiResponse,
                      translated: translatedResponse
                    },
                    sender: 'assistant',
                    timestamp: Date.now(),
                    isEdited: false
                  };

                  // Add AI response and update storage again
                  const finalMessageList = [...newMessageList, newAiMessage];
                  dispatch({ type: 'ADD_MESSAGE', payload: newAiMessage });

                  if (currentSession) {
                    const finalSession = {
                      ...currentSession,
                      messages: finalMessageList,
                      lastUpdated: Date.now(),
                    };
                    await StorageService.saveSession(finalSession);
                    setCurrentSession(finalSession);
                  }
                }

              } catch (error) {
                console.error('Edit error:', error);
                Alert.alert("Error", "Failed to save edit: " + (error as Error).message);
              } finally {
                dispatch({ type: "SET_LOADING", payload: false });
              }
            },
          },
        ],
        "plain-text",
        textToEdit
      );
    },
    [message, targetLanguage, dispatch, state.messages, currentScenario, currentSession, setCurrentSession]
  );

  const handleLongPress = useCallback(() => {
    Alert.alert("Edit Message", "What would you like to edit?", [
      {
        text: isUser ? "Edit My Message" : "Edit Original Text",
        onPress: () => handleEdit("original"),
      },
      {
        text: isUser ? "Edit Translation" : "Edit English Translation",
        onPress: () => handleEdit("translation"),
      },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [handleEdit, isUser]);

  const backgroundColor = useThemeColor(
    {
      light: isUser ? "#007AFF" : "#E9ECEF",
      dark: isUser ? "#0A84FF" : "#2C2C2E",
    },
    "background"
  );

  const textColor = useThemeColor(
    { light: isUser ? "#FFFFFF" : "#000000", dark: "#FFFFFF" },
    "text"
  );

  return (
    <Pressable onLongPress={handleLongPress}>
      <View style={[styles.container, isUser ? styles.userContainer : styles.assistantContainer]}>
        <View
          style={[
            styles.bubble,
            { backgroundColor },
            isUser ? styles.userBubble : styles.assistantBubble,
          ]}
        >
          <View style={styles.messageContent}>
            <ThemedText style={[styles.originalText, { color: textColor }]}>
              {message.content.original}
            </ThemedText>
            <ThemedText style={[styles.translatedText, { color: textColor, opacity: 0.8 }]}>
              {message.content.translated}
            </ThemedText>
            {message.isEdited && (
              <ThemedText style={[styles.editedText, { color: textColor, opacity: 0.6 }]}>
                edited
              </ThemedText>
            )}
          </View>

          <Pressable
            style={[styles.speakerIcon, isSpeaking && styles.speakerIconActive]}
            onPress={handleSpeak}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {isSpeaking ? (
              <View style={styles.stopIcon} />
            ) : (
              <Ionicons name="volume-high" size={18} color={textColor} />
            )}
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  bubble: {
    maxWidth: "80%",
    padding: 12,
    borderRadius: 20,
    position: "relative",
    minWidth: 60,
  },
  stopIcon: {
    width: 18,
    height: 18,
    backgroundColor: "red",
    borderRadius: 2,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  userBubble: {
    borderTopRightRadius: 4,
    marginLeft: 40,
  },
  assistantBubble: {
    borderTopLeftRadius: 4,
    marginRight: 40,
  },
  messageContent: {
    marginRight: 28,
  },
  originalText: {
    fontSize: 16,
    marginBottom: 4,
    lineHeight: 20,
  },
  translatedText: {
    fontSize: 14,
    lineHeight: 18,
  },
  editedText: {
    fontSize: 12,
    marginTop: 4,
  },
  speakerIcon: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  speakerIconActive: {
    backgroundColor: "rgba(0,0,0,0.1)",
  },
});