// components/ui/ChatBubble.tsx
import React, { memo, useCallback, useState, useEffect } from "react";
import { StyleSheet, View, Pressable, Alert, TouchableOpacity } from "react-native";
import { ChatMessage } from "@/types";
import { Body1, Body2, Caption } from "./Typography";
import { useTheme } from "@/lib/theme/theme";
import { useChatContext } from "../../contexts/ChatContext";
import { OpenAIService } from "../../lib/services/openai";
import { useAppStore } from "../../hooks/useAppStore";
import { SpeechService } from "@/lib/services/speech";
import { Feather } from '@expo/vector-icons';
import { generateId } from '@/lib/utils/ids';
import { StorageService } from '@/lib/services/storage';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS, // Import runOnJS (though not used in this version, kept for potential future use)
} from "react-native-reanimated";

// Define a reasonable max height for the translation text area
const MAX_TRANSLATION_HEIGHT = 200; // Adjust as needed

export const ChatBubble = memo(function ChatBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const { state, dispatch } = useChatContext();
  const source_language = useAppStore((state) => state.source_language);
  const currentSession = useAppStore((state) => state.currentSession);
  const target_language = useAppStore((state) => state.target_language);
  const currentScenario = useAppStore((state) => state.currentScenario);
  const setCurrentSession = useAppStore((state) => state.setCurrentSession);

  const theme = useTheme();

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isTranslationVisible, setIsTranslationVisible] = useState(false);
  const translationOpacity = useSharedValue(0);
  const translationMaxHeight = useSharedValue(0);

  const isUser = message.sender === "user";

  // Cleanup speech when component unmounts
  useEffect(() => {
    return () => {
      // Directly call stop if speaking, assuming SpeechService.stop is safe to call from cleanup
      if (isSpeaking) {
        SpeechService.stop();
      }
    };
  }, [isSpeaking]); // Dependency remains isSpeaking

  // Handle translation visibility change
  useEffect(() => {
    const targetOpacity = isTranslationVisible ? 1 : 0;
    const targetMaxHeight = isTranslationVisible ? MAX_TRANSLATION_HEIGHT : 0;

    translationOpacity.value = withTiming(targetOpacity, { duration: 250 });
    translationMaxHeight.value = withTiming(targetMaxHeight, { duration: 300 });

  }, [isTranslationVisible, translationOpacity, translationMaxHeight]);

  // --- MOVED handleStop BEFORE handleSpeak ---
  // Handle stop
  const handleStop = useCallback(async () => {
     try {
      await SpeechService.stop();
    } finally {
      // Ensure state is updated correctly
      setIsSpeaking(false);
    }
  }, []); // Empty dependency array is correct here

  // Speech handling
  const handleSpeak = useCallback(async () => {
     if (isSpeaking) {
      await handleStop(); // Now handleStop is declared above
      return;
    }

    try {
      const textToSpeak = message.content.original;
      const languageToSpeak = isUser ? source_language : currentSession?.target_language;

      if (!languageToSpeak) {
        console.error("No language available for speech");
        return;
      }

      setIsSpeaking(true); // Set state immediately
      await SpeechService.speak(textToSpeak, languageToSpeak);
    } catch (error) {
      console.error("Speech error:", error);
      Alert.alert("Speech Error", "Unable to play speech. Please try again.");
    } finally {
      // Ensure state is updated correctly even if SpeechService call fails internally
      setIsSpeaking(false);
    }
    // Dependencies: handleStop is now stable due to its empty dependency array
  }, [message.content.original, isUser, source_language, currentSession?.target_language, isSpeaking, handleStop]);

  const toggleTranslation = () => {
    setIsTranslationVisible(!isTranslationVisible);
  };

  // Message editing functionality
  const handleEdit = useCallback(
    async (editType: "original" | "translation") => {
       if (!target_language || !currentScenario) {
        console.log('Missing targetLanguage or currentScenario:', { target_language, currentScenario });
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

                let updatedMessage: ChatMessage;

                if (message.sender === 'assistant') {
                  if (editType === 'translation') {
                    // If editing English translation of AI message, translate to target language
                    const newOriginal = await OpenAIService.translateText(
                      newText,
                      target_language.name
                    );
                    updatedMessage = {
                      ...message,
                      content: {
                        original: newOriginal,
                        translated: newText,
                      },
                      isEdited: true,
                      sender: message.sender as "assistant",
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
                        original: newText,
                        translated: newTranslation,
                      },
                      isEdited: true,
                      sender: message.sender as "assistant",
                    };
                  }
                } else {
                  // User message handling
                  const translationResult = await OpenAIService.translateText(
                    newText,
                    editType === "original" ? target_language.name : "English"
                  );

                  updatedMessage = {
                    ...message,
                    content: {
                      original: editType === "original" ? newText : translationResult,
                      translated: editType === "original" ? translationResult : newText,
                    },
                    isEdited: true,
                    sender: message.sender as "user",
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

                // Generate new AI response for edited user messages
                if (message.sender === 'user') {
                  const aiResponse = await OpenAIService.generateChatCompletion(
                    newMessageList,
                    currentScenario,
                    target_language.name
                  );

                  const translatedResponse = await OpenAIService.translateText(
                    aiResponse,
                    'English'
                  );

                  const newAiMessage: ChatMessage = {
                    id: generateId(),
                    content: {
                      original: aiResponse,
                      translated: translatedResponse
                    },
                    sender: "assistant",
                    timestamp: Date.now(),
                    isEdited: false
                  };

                  // Add AI response and update storage
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
    [message, target_language, dispatch, state.messages, currentScenario, currentSession, setCurrentSession]
  );

  // Handle long press
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

  // Styling
  const backgroundColor = isUser
    ? theme.colors.primary.main
    : theme.colors.background.paper;

  const textColor = isUser
    ? theme.colors.primary.contrast
    : theme.colors.text.primary;

  // Animated styles
  const translationStyle = useAnimatedStyle(() => {
    return {
      opacity: translationOpacity.value,
      maxHeight: translationMaxHeight.value, // Use animated maxHeight
      overflow: 'hidden', // Crucial for height animation
    };
  });

  return (
    <Pressable
      style={[
        styles.container,
        isUser ? styles.userContainer : styles.assistantContainer
      ]}
      onLongPress={handleLongPress}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor,
            borderColor: isUser ? 'transparent' : theme.colors.divider,
          },
          isUser ? styles.userBubble : styles.assistantBubble,
          !isUser && styles.assistantBubbleShadow,
        ]}
      >
        <View style={styles.messageContent}>
          <Body1 style={styles.originalText} color={textColor}>
            {message.content.original}
          </Body1>

          {/* Only render translation container if there's text */}
          {message.content.translated && message.content.translated.trim() !== "" && (
            // Apply animated style here
            <Animated.View style={[styles.translationContainer, translationStyle]}>
              <Body2
                style={styles.translatedText}
                color={isUser ? theme.colors.primary.light : theme.colors.text.secondary}
              >
                {message.content.translated}
              </Body2>
            </Animated.View>
          )}

          <View style={styles.messageFooter}>
            {message.isEdited && (
              <Caption
                style={styles.editedText}
                color={isUser ? theme.colors.primary.light : theme.colors.text.hint}
              >
                edited
              </Caption>
            )}

            {/* Conditionally render toggle only if there is translated text */}
            {message.content.translated && message.content.translated.trim() !== "" && (
              <TouchableOpacity
                style={styles.translationToggle}
                onPress={toggleTranslation}
              >
                <Caption
                  color={isUser ? theme.colors.primary.light : theme.colors.text.hint}
                >
                  {isTranslationVisible ? "Hide translation" : "Show translation"}
                </Caption>
              </TouchableOpacity>
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.speakerButton, isSpeaking && styles.speakerButtonActive]}
          onPress={handleSpeak}
        >
          {isSpeaking ? (
            <Feather
              name="square"
              size={16}
              color={isUser ? theme.colors.primary.contrast : theme.colors.primary.main}
            />
          ) : (
            <Feather
              name="volume-2"
              size={16}
              color={isUser ? theme.colors.primary.contrast : theme.colors.primary.main}
            />
          )}
        </TouchableOpacity>
      </View>

      <Caption
        style={styles.timestamp}
        color={theme.colors.text.hint}
      >
        {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Caption>
    </Pressable>
  );
});

// Styles
const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingHorizontal: 8,
    marginVertical: 8,
  },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    position: "relative",
    minWidth: 60,
  },
  userContainer: {
    alignItems: "flex-end",
  },
  assistantContainer: {
    alignItems: "flex-start",
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    borderBottomLeftRadius: 4,
  },
  assistantBubbleShadow: {
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  messageContent: {
    marginRight: 32, // Space for speaker button
  },
  originalText: {
    marginBottom: 4,
  },
  translationContainer: {
    marginTop: 4,
    // overflow: 'hidden' is handled by animated style now
  },
  translatedText: {
    fontStyle: 'italic',
  },
  messageFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    flexWrap: 'wrap',
  },
  editedText: {
    marginRight: 8,
    lineHeight: 16,
  },
  translationToggle: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  speakerButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  speakerButtonActive: {
    backgroundColor: "rgba(255,0,0,0.15)",
  },
  timestamp: {
    marginTop: 2,
    marginHorizontal: 4,
  },
});
