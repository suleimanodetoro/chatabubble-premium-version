import React, { memo, useCallback, useState } from "react";
import { StyleSheet, View, Pressable, Alert } from "react-native";
import { ThemedText } from "../ThemedText";
import { useThemeColor } from "@/hooks/useThemeColor";
import { ChatMessage } from "@/types";
import { useChatContext } from "../../contexts/ChatContext";
import { OpenAIService } from "../../lib/services/openai";
import { useAppStore } from "../../hooks/useAppStore";
import { SpeechService } from "@/lib/services/speech";
import { Ionicons } from '@expo/vector-icons';


export const ChatBubble = memo(function ChatBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const { dispatch } = useChatContext();

  const sourceLanguage = useAppStore((state) => state.sourceLanguage);
  const currentSession = useAppStore((state) => state.currentSession);
  const targetLanguage = useAppStore((state) => state.targetLanguage);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const isUser = message.sender === "user";

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

  const handleSpeak = useCallback(async () => {
    try {
      setIsSpeaking(true);

      const textToSpeak = message.content.original;
      const languageToSpeak = isUser ? sourceLanguage : currentSession?.targetLanguage;

      if (!languageToSpeak) {
        console.error("No language available for speech");
        return;
      }

      await SpeechService.speak(textToSpeak, languageToSpeak);
    } catch (error) {
      console.error("Speech error:", error);
      Alert.alert("Speech Error", "Unable to play speech. Please try again.");
    } finally {
      // When speech finishes or fails, set isSpeaking back to false
      setIsSpeaking(false);
    }
  }, [message.content.original, isUser, sourceLanguage, currentSession?.targetLanguage]);

  const handleStop = useCallback(async () => {
    try {
      await SpeechService.stop();
    } catch (error) {
      console.error("Error stopping speech:", error);
    } finally {
      // Ensure we set this to false even if stop fails
      setIsSpeaking(false);
    }
  }, []);

  const handleEdit = useCallback(
    async (editType: "original" | "translation") => {
      if (!targetLanguage) return;

      const textToEdit =
        editType === "original" ? message.content.original : message.content.translated;

      Alert.prompt(
        "Edit Message",
        `Edit ${editType === "original" ? "message" : "translation"}:`,
        [
          {
            text: "Cancel",
            style: "cancel",
            onPress: () => {},
          },
          {
            text: "Save",
            onPress: async (newText?: string) => {
              if (!newText?.trim()) return;

              dispatch({ type: "SET_LOADING", payload: true });

              try {
                const translationResult = await OpenAIService.translateText(
                  newText,
                  editType === "original" ? targetLanguage.name : "English"
                );

                dispatch({
                  type: "UPDATE_MESSAGE",
                  payload: {
                    id: message.id,
                    message: {
                      content: {
                        original: editType === "original" ? newText : translationResult,
                        translated: editType === "original" ? translationResult : newText,
                      },
                      isEdited: true,
                    },
                  },
                });
              } catch (error) {
                Alert.alert("Error", "Failed to save edit");
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
    [message.id, message.content, targetLanguage, dispatch]
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
            onPress={isSpeaking ? handleStop : handleSpeak}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={false} // Always allow pressing to stop instantly
          >
            {isSpeaking ? (
              // Red square to indicate stop
              <View style={{ width: 18, height: 18, backgroundColor: "red", borderRadius: 2 }} />
            ) : (
              // Speaker icon when not speaking
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
