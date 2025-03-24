// app/(chat)/[id].tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  AppState,
  ActivityIndicator,
  FlatList,
  Pressable,
  TouchableOpacity,
  TextInput,
  Text,
  Keyboard,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatContext } from "@/contexts/ChatContext";
import { useAppStore } from "@/hooks/useAppStore";
import { SessionManager } from "@/lib/services/sessionManager";
import { useTheme } from "@/lib/theme/theme";
import { OpenAIService } from "@/lib/services/openai";
import { generateId } from "@/lib/utils/ids";
import { StorageService } from "@/lib/services/storage";
import { Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Custom ChatButton component to avoid circular dependencies
const ChatButton = ({
  onPress,
  disabled,
  loading,
  style,
  icon,
  variant = "primary",
  children,
}) => {
  const theme = useTheme();

  const getBackgroundColor = () => {
    if (disabled) return "#E5E7EB";
    if (variant === "primary") return theme.colors.primary.main;
    return "transparent";
  };

  const getTextColor = () => {
    if (disabled) return "#9CA3AF";
    if (variant === "primary") return "#FFFFFF";
    return theme.colors.primary.main;
  };

  return (
    <TouchableOpacity
      style={[
        {
          height: 40,
          borderRadius: 20,
          backgroundColor: getBackgroundColor(),
          justifyContent: "center",
          alignItems: "center",
          paddingHorizontal: 16,
          flexDirection: "row",
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={getTextColor()} />
      ) : (
        <>
          {icon && (
            <Feather
              name={icon}
              size={18}
              color={getTextColor()}
              style={{ marginRight: children ? 8 : 0 }}
            />
          )}
          {children && (
            <Text
              style={{ color: getTextColor(), fontWeight: "600", fontSize: 16 }}
            >
              {children}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

// Enhanced chat input with animations and better UX
const ChatInput = ({
  onSend,
  disabled = false,
  loading = false,
  targetLanguageName = "",
}) => {
  const [text, setText] = useState("");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);

  const handleSend = () => {
    if (!text.trim() || disabled || loading) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <View
      style={[
        styles.inputContainer,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {/* Language indicator */}
      {targetLanguageName && (
        <View style={styles.languageIndicator}>
          <Feather name="globe" size={12} color={theme.colors.text.secondary} />
          <Caption color={theme.colors.text.secondary}>
            Speaking in {targetLanguageName}
          </Caption>
        </View>
      )}

      <View style={styles.inputRow}>
        <View
          style={[styles.textInputContainer, disabled && styles.disabledInput]}
        >
          <AnimatedTextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={disabled ? "Chat session ended" : "Type a message..."}
            placeholderTextColor={theme.colors.text.hint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            editable={!disabled && !loading}
          />

          <TouchableOpacity
            style={styles.voiceButton}
            disabled={disabled || loading}
          >
            <Feather
              name="mic"
              size={20}
              color={
                disabled
                  ? theme.colors.text.disabled
                  : theme.colors.primary.main
              }
            />
          </TouchableOpacity>
        </View>

        <ChatButton
          variant="primary"
          icon="send"
          style={[
            styles.sendButton,
            { width: 44, height: 44 }, // Perfect circle
          ]}
          disabled={!text.trim() || disabled || loading}
          onPress={handleSend}
          loading={loading}
        />
      </View>
    </View>
  );
};

// Animated header for the chat screen
const ChatHeader = ({ 
  title,
  subtitle,
  onBack,
  onInfo,
  onEndChat,  
  canEndChat,
  condensed,
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Animated.View style={[
      styles.header, 
      { 
        height: condensed ? 60 + insets.top : 80 + insets.top,
        paddingTop: insets.top 
      }
    ]}>
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={95} />
      <View style={styles.headerContent}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Feather name="chevron-left" size={24} color={theme.colors.primary.main} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Heading3 numberOfLines={1} style={styles.headerTitle}>
            {title}
          </Heading3>
          
          {!condensed && (
            <View>
              <Body2 color={theme.colors.text.secondary} numberOfLines={1}>
                {subtitle}
              </Body2>
            </View>
          )}
        </View>
        
        <View style={styles.headerActions}>
          {canEndChat && (
            <TouchableOpacity style={styles.endChatHeaderButton} onPress={onEndChat}>
              <Feather name="x-circle" size={20} color="#E53E3E" />
            </TouchableOpacity>
          )}
          
          {onInfo && (
            <TouchableOpacity style={styles.infoButton} onPress={onInfo}>
              <Feather name="info" size={20} color={theme.colors.primary.main} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

// Scenario info modal component
const ScenarioInfoCard = ({ scenario, isVisible, onClose }) => {
  const theme = useTheme();

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[styles.infoCardContainer]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </BlurView>

      <Animated.View style={styles.infoCard} entering={SlideInUp.springify()}>
        <View style={styles.infoCardHandle} />

        <Heading3 style={styles.infoCardTitle}>{scenario.title}</Heading3>
        <Body1 style={styles.infoCardDescription}>{scenario.description}</Body1>

        <View style={styles.personaSection}>
          <Heading3 style={styles.sectionTitle}>Conversation Partner</Heading3>

          <View style={styles.personaContainer}>
            <View style={styles.personaAvatar}>
              <Feather name="user" size={24} color="#fff" />
            </View>
            <View style={styles.personaDetails}>
              <Body1 weight="semibold">{scenario.persona.name}</Body1>
              <Body2 color={theme.colors.text.secondary}>
                {scenario.persona.role}
              </Body2>
            </View>
          </View>

          <Body1 style={styles.personalityText}>
            {scenario.persona.personality}
          </Body1>

          <View style={styles.infoTags}>
            <View style={styles.infoTag}>
              <Caption>Style: </Caption>
              <Caption weight="semibold">
                {scenario.persona.languageStyle}
              </Caption>
            </View>

            <View style={styles.infoTag}>
              <Caption>Difficulty: </Caption>
              <Caption weight="semibold">{scenario.difficulty}</Caption>
            </View>

            <View style={styles.infoTag}>
              <Caption>Language: </Caption>
              <Caption weight="semibold">
                {scenario.target_language.name}
              </Caption>
            </View>
          </View>
        </View>

        <ChatButton
          variant="primary"
          style={styles.closeButton}
          onPress={onClose}
        >
          Close
        </ChatButton>
      </Animated.View>
    </Animated.View>
  );
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { state, dispatch } = useChatContext();
  const { currentSession, currentScenario, setCurrentSession } = useAppStore();
  const [showInfo, setShowInfo] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const listRef = useRef(null);
  const headerHeight = 80 + insets.top;
  
  // Scroll tracking 
  const [condensedHeader, setCondensedHeader] = useState(false);
  const [inputHeight, setInputHeight] = useState(80); // Default estimate
  const isUserScrollingRef = useRef(false);
  const scrollTriggerTimeoutRef = useRef(null);
  const initialScrollCompleteRef = useRef(false);
  const isProcessingMessageRef = useRef(false);
  
  // Calculate dynamic padding for list based on input height
  const listPadding = {
    paddingBottom: inputHeight + 20, // Additional padding for better visibility
  };

  // Improved scroll to bottom function with better debouncing
  const scrollToBottom = useCallback((delay = 200, animated = true) => {
    // Clear any existing scroll timeout to prevent multiple scrolls
    if (scrollTriggerTimeoutRef.current) {
      clearTimeout(scrollTriggerTimeoutRef.current);
    }
    
    scrollTriggerTimeoutRef.current = setTimeout(() => {
      if (listRef.current && state.messages.length > 0 && !isUserScrollingRef.current) {
        listRef.current.scrollToOffset({
          offset: 999999, // Large enough to ensure we reach the bottom
          animated: animated,
        });
      }
    }, delay);
  }, []); // Remove dependency on messages length to prevent recreation

  // Handle app state changes and cleanup
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (!currentSession || !state.messages.length) return;

      if (nextAppState === "background" || nextAppState === "inactive") {
        SessionManager.handleSessionEnd(currentSession, state.messages).catch(
          (error) => console.error("Session cleanup error:", error)
        );
      }
    });

    return () => {
      subscription.remove();
      // Cleanup on component unmount
      if (currentSession && state.messages.length) {
        SessionManager.handleSessionEnd(currentSession, state.messages).catch(
          (error) => console.error("Unmount cleanup error:", error)
        );
      }
      // Clear any pending timeouts
      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
    };
  }, [currentSession, state.messages]);

  // Initial chat state loading
  useEffect(() => {
    let loadTimeoutId = null;
    
    async function loadChatState() {
      if (!id || !currentSession) return;
      try {
        dispatch({ type: "SET_SESSION", payload: id.toString() });
        await SessionManager.loadSession(
          id.toString(),
          currentSession,
          dispatch
        );
        
        // Use a ref to track the loading timeout for cleanup
        loadTimeoutId = setTimeout(() => {
          scrollToBottom(100, false);
          initialScrollCompleteRef.current = true;
        }, 500);
      } catch (error) {
        console.error("Error loading chat state:", error);
        Alert.alert("Error", "Failed to load chat history");
      }
    }
    
    loadChatState();
    
    // Clean up the timeout if component unmounts during initial load
    return () => {
      if (loadTimeoutId) {
        clearTimeout(loadTimeoutId);
      }
    };
  }, [id, scrollToBottom]);

  // Consolidated effect for scrolling on state changes
  useEffect(() => {
    // Only auto-scroll when messages change AND not during user scrolling
    // AND after initial load is complete
    if (
      state.messages.length > 0 && 
      initialScrollCompleteRef.current && 
      !isUserScrollingRef.current
    ) {
      // Use a longer delay for better reliability
      scrollToBottom(500, true);
    }
  }, [state.messages.length, scrollToBottom]);

  // Handle ending the chat
  const handleEndChat = useCallback(() => {
    Alert.alert(
      "End Conversation",
      "Are you sure you want to end this conversation?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            try {
              await SessionManager.handleSessionEnd(
                currentSession,
                state.messages,
                true
              );
              dispatch({ type: "SET_STATUS", payload: "completed" });
              router.back();
            } catch (error) {
              console.error("Error ending session:", error);
              Alert.alert("Error", "Failed to end conversation");
            }
          },
        },
      ]
    );
  }, [currentSession, state.messages]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (!currentSession || !state.messages.length) {
      router.back();
      return;
    }
    Alert.alert(
      "Leave Conversation",
      "Do you want to save and continue later, or end this conversation?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Save & Continue Later",
          onPress: async () => {
            try {
              await SessionManager.handleSessionEnd(
                currentSession,
                state.messages,
                false
              );
              router.back();
            } catch (error) {
              console.error("Error saving session:", error);
              Alert.alert("Error", "Failed to save conversation");
            }
          },
        },
        {
          text: "End Conversation",
          style: "destructive",
          onPress: async () => {
            try {
              await SessionManager.handleSessionEnd(
                currentSession,
                state.messages,
                true
              );
              router.back();
            } catch (error) {
              console.error("Error ending session:", error);
              Alert.alert("Error", "Failed to end conversation");
            }
          },
        },
      ]
    );
  }, [currentSession, state.messages, router]);

  // Handle sending a message with protection against duplicate sends
  const handleSend = useCallback(
    async (text) => {
      // Prevent multiple sends while processing a message
      if (
        !currentSession ||
        !currentScenario ||
        !text.trim() ||
        state.isLoading ||
        isProcessingMessageRef.current
      )
        return;
        
      // Set processing flag to prevent duplicate sends
      isProcessingMessageRef.current = true;
        
      try {
        // Create a new message
        const newMessage = {
          id: Date.now().toString(),
          content: {
            original: text,
            translated: "Translating...",
          },
          sender: "user",
          timestamp: Date.now(),
          isEdited: false,
        };

        // Add to context and set loading state
        dispatch({ type: "ADD_MESSAGE", payload: newMessage });
        dispatch({ type: "SET_LOADING", payload: true });
        
        // Dismiss keyboard - don't call scrollToBottom here, let the effect handle it
        Keyboard.dismiss();

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
          type: "UPDATE_MESSAGE",
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
          id: generateId(),
          content: {
            original: aiResponse,
            translated: translatedAiResponse,
          },
          sender: "assistant",
          timestamp: Date.now(),
          isEdited: false,
        };

        dispatch({ type: "ADD_MESSAGE", payload: aiMessage });

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
        console.error("Error sending message:", error);
        Alert.alert("Error", "Failed to send message");
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
        // Reset processing flag after completion
        isProcessingMessageRef.current = false;
      }
    },
    [
      currentSession,
      currentScenario,
      state.messages,
      state.isLoading,
      dispatch,
      setCurrentSession,
    ]
  );

  // Render a loading view if needed
  if (!currentSession || !currentScenario) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Body1 style={{ marginTop: 20 }}>Loading conversation...</Body1>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <ChatHeader
        title={currentScenario.title}
        subtitle={currentSession.target_language.name}
        onBack={handleBack}
        onInfo={() => setShowInfo(true)}
        onEndChat={handleEndChat}
        canEndChat={state.status === 'active' && state.messages.length > 0}
        condensed={condensedHeader}
      />

      {/* Status Banner */}
      {state.status !== "active" && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Conversation Ended</Text>
          <ChatButton
            variant="primary"
            onPress={() => router.replace("/(tabs)/scenarios")}
          >
            Start New
          </ChatButton>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={listRef}
        data={state.messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ChatBubble message={item} />}
        contentContainerStyle={[
          styles.messagesList,
          { paddingTop: headerHeight },
          listPadding, // Dynamic padding based on input height
        ]}
        onScrollBeginDrag={() => {
          isUserScrollingRef.current = true;
        }}
        onMomentumScrollEnd={() => {
          // Reset after scroll momentum ends with a delay
          setTimeout(() => {
            isUserScrollingRef.current = false;
          }, 1000);
        }}
        onEndReached={() => {
          // When we reach the end, allow auto-scroll again
          isUserScrollingRef.current = false;
        }}
        onScroll={(event) => {
          // Check scroll position for header condensing
          const offsetY = event.nativeEvent.contentOffset.y;
          setCondensedHeader(offsetY > 50);
        }}
        scrollEventThrottle={16}
        onContentSizeChange={() => {
          // Only scroll on content size change if initial load is complete
          // and we're not during user scrolling
          if (!isUserScrollingRef.current && initialScrollCompleteRef.current) {
            // Use a short delay to allow rendering to complete
            scrollToBottom(150, true);
          }
        }}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyIconContainer}>
              <Feather
                name="message-circle"
                size={40}
                color={theme.colors.text.hint}
              />
            </View>
            <Body1
              color={theme.colors.text.secondary}
              style={styles.emptyChatText}
            >
              Start the conversation by sending a message
            </Body1>
          </View>
        }
      />

      {/* Input Area */}
      <View 
        style={styles.inputWrapper}
        onLayout={(event) => {
          // Measure input height to adjust bottom padding
          const height = event.nativeEvent.layout.height;
          if (height !== inputHeight) {
            setInputHeight(height);
          }
        }}
      >
        <ChatInput
          onSend={handleSend}
          disabled={state.status !== "active"}
          loading={state.isLoading}
          targetLanguageName={currentSession.target_language.name}
        />
      </View>

      {/* Scenario Info Modal */}
      <ScenarioInfoCard
        scenario={currentScenario}
        isVisible={showInfo}
        onClose={() => setShowInfo(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.1)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    height: "100%",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: "center",
  },
  headerTitle: {
    textAlign: "center",
  },
  infoButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusBanner: {
    position: "absolute",
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    padding: 12,
    zIndex: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "500",
  },
  messagesList: {
    paddingHorizontal: 16,
    // Bottom padding is dynamically computed based on input height
  },
  emptyChat: {
    marginTop: 100,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyChatText: {
    textAlign: "center",
    maxWidth: 250,
  },
  inputWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
    // Add shadow for better visibility
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 8,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  languageIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  textInputContainer: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingTop: 4,
    paddingBottom: 4,
    maxHeight: 100,
  },
  voiceButton: {
    padding: 6,
    marginBottom: 2,
    marginLeft: 4,
  },
  sendButton: {
    borderRadius: 22,  // Make it perfectly round
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  infoCardContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "flex-end",
    zIndex: 20,
  },
  infoCard: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    maxHeight: "80%",
  },
  infoCardHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#CBD5E1",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  infoCardTitle: {
    marginBottom: 8,
  },
  infoCardDescription: {
    marginBottom: 24,
    opacity: 0.8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  personaSection: {
    marginBottom: 24,
  },
  personaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  personaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4A6FFF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  personaDetails: {
    flex: 1,
  },
  personalityText: {
    marginBottom: 16,
  },
  infoTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  infoTag: {
    flexDirection: "row",
    alignItems: "center",
  },
  closeButton: {
    alignSelf: "center",
    minWidth: 120,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  endChatHeaderButton: {
    padding: 8,
    marginRight: 4,
  },
});