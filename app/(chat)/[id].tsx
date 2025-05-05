// app/(chat)/[id].tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Alert, // Ensure Alert is imported
  AppState,
  ActivityIndicator,
  FlatList,
  Pressable,
  TouchableOpacity,
  TextInput,
  Text,
  Keyboard,
  Platform, // Import Platform
  ListRenderItemInfo, // Import ListRenderItemInfo for FlatList renderItem type
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatState, useChatContext } from "@/contexts/ChatContext";
import { useTheme } from "@/lib/theme/theme";
import {
  SessionManager,
  SessionLoadError,
} from "@/lib/services/sessionManager";
import { useAppStore } from "@/hooks/useAppStore";
import { Session, Scenario, ChatMessage, Language } from "@/types";
import { Dispatch } from "react"; // Keep Dispatch type
import { OpenAIService } from "@/lib/services/openai";
import { generateId } from "@/lib/utils/ids";
import { Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  useAnimatedStyle, // Keep if needed by components below
  withTiming, // Keep if needed by components below
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { ProfileService } from "@/lib/services/profile"; // Import ProfileService
import { StorageService } from "@/lib/services/storage"; // Import StorageService for saving after AI response

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// --- Helper Components (Defined within this file for completeness) ---

// Basic Button Component (Adapt from your Button.tsx if needed)
const ChatButton = ({
  onPress,
  disabled,
  loading,
  style,
  icon,
  variant = "primary",
  children,
}: {
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
  icon?: keyof typeof Feather.glyphMap;
  variant?: "primary" | "secondary" | "tertiary";
  children?: React.ReactNode;
}) => {
  const theme = useTheme();
  const getBackgroundColor = () => {
    if (disabled) return "#E5E7EB"; // Use a disabled color
    if (variant === "primary") return theme.colors.primary.main;
    if (variant === "secondary") return theme.colors.primary.light; // Example secondary color
    return "transparent";
  };
  const getTextColor = () => {
    if (disabled) return "#9CA3AF"; // Use a disabled text color
    if (variant === "primary") return theme.colors.primary.contrast;
    return theme.colors.primary.main; // Default for secondary/tertiary
  };
  return (
    <TouchableOpacity
      style={[
        styles.chatButtonBase, // Use a base style
        { backgroundColor: getBackgroundColor() },
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
            <Text style={[styles.chatButtonText, { color: getTextColor() }]}>
              {children}
            </Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

// Basic Chat Input Component (Adapt from your ChatInput.tsx if needed)
const ChatInput = ({
  onSend,
  loading = false,
  targetLanguageName = "",
  status,
  maxLength,
}: {
  onSend: (text: string) => void;
  loading?: boolean;
  targetLanguageName?: string;
  status: ChatState["status"];
  maxLength?: number;
}) => {
  const [text, setText] = useState("");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  const isDisabled = status !== 'active' && status !== 'saved';
  const handleSend = () => {
    if (!text.trim() || isDisabled || loading) return;
    onSend(text.trim());
    setText("");
    Keyboard.dismiss(); // Dismiss keyboard on send
  };

  const getPlaceholderText = () => {
    if (status === 'completed') return "Conversation Ended";
    if (status === 'saved') return "Type to resume...";
    return "Type a message...";
  };

  return (
    <View
      style={[
        styles.inputContainer,
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {targetLanguageName && status === 'active' && ( // Only show language when active
        <View style={styles.languageIndicator}>
          <Feather name="globe" size={12} color={theme.colors.text.secondary} />
          <Caption color={theme.colors.text.secondary} style={{ marginLeft: 4 }}>
            Speaking in {targetLanguageName}
          </Caption>
        </View>
      )}
      <View style={styles.inputRow}>
        <View style={[styles.textInputContainer, isDisabled && styles.disabledInput]}>
          <AnimatedTextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={getPlaceholderText()}
            placeholderTextColor={theme.colors.text.hint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={maxLength}
            editable={!isDisabled && !loading}
            scrollEnabled={true}
            blurOnSubmit={false} // Prevent keyboard dismiss on multiline submit
            onSubmitEditing={handleSend} // Allow sending via keyboard submit
          />
          {/* Placeholder for Voice Button */}
          {/* <TouchableOpacity style={styles.voiceButton} disabled={isDisabled || loading}>
            <Feather name="mic" size={20} color={isDisabled ? theme.colors.text.disabled : theme.colors.primary.main} />
          </TouchableOpacity> */}
        </View>
        <ChatButton
          variant="primary"
          icon="send"
          style={[styles.sendButton]} // Use specific style
          disabled={!text.trim() || isDisabled || loading}
          onPress={handleSend}
          loading={loading}
        />
      </View>
    </View>
  );
};

// Basic Chat Header Component (Adapt from your ChatHeader.tsx if needed)
const ChatHeader = ({
  title,
  subtitle,
  onBack,
  onInfo,
  onEndChat,
  canEndChat,
  condensed,
}: {
  title: string;
  subtitle: string;
  onBack: () => void;
  onInfo?: () => void;
  onEndChat: () => void;
  canEndChat: boolean;
  condensed: boolean;
}) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      style={[
        styles.header,
        {
          height: condensed ? 60 + insets.top : 80 + insets.top,
          paddingTop: insets.top,
        },
      ]}
      // Add layout animation if desired
    >
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
              <Feather name="x-circle" size={20} color={theme.colors.error.main} />
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

// Basic Scenario Info Card Component (Adapt from your ScenarioInfoCard.tsx if needed)
const ScenarioInfoCard = ({
  scenario,
  isVisible,
  onClose,
}: {
  scenario: Scenario | null;
  isVisible: boolean;
  onClose: () => void;
}) => {
  const theme = useTheme();
  if (!isVisible || !scenario) return null;
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
        <Heading3 style={styles.infoCardTitle}>{scenario.title ?? "Scenario Title"}</Heading3>
        <Body1 style={styles.infoCardDescription}>{scenario.description ?? "No description available."}</Body1>
        <View style={styles.personaSection}>
          <Heading3 style={styles.sectionTitle}>Conversation Partner</Heading3>
          <View style={styles.personaContainer}>
            <View style={styles.personaAvatar}>
              <Feather name="user" size={24} color="#fff" />
            </View>
            <View style={styles.personaDetails}>
              <Body1 weight="semibold">{scenario.persona?.name ?? "Unknown"}</Body1>
              <Body2 color={theme.colors.text.secondary}>{scenario.persona?.role ?? "Unknown Role"}</Body2>
            </View>
          </View>
          <Body1 style={styles.personalityText}>{scenario.persona?.personality ?? "No personality description."}</Body1>
          <View style={styles.infoTags}>
            <View style={styles.infoTag}><Caption>Style: </Caption><Caption weight="semibold" style={{ marginLeft: 4 }}>{scenario.persona?.languageStyle ?? "N/A"}</Caption></View>
            <View style={styles.infoTag}><Caption>Difficulty: </Caption><Caption weight="semibold" style={{ marginLeft: 4 }}>{scenario.difficulty ?? "N/A"}</Caption></View>
            <View style={styles.infoTag}><Caption>Language: </Caption><Caption weight="semibold" style={{ marginLeft: 4 }}>{scenario.target_language?.name ?? "N/A"}</Caption></View>
          </View>
        </View>
        <ChatButton variant="primary" style={styles.closeButton} onPress={onClose}>Close</ChatButton>
      </Animated.View>
    </Animated.View>
  );
};
// --- End Helper Components ---


// Main Chat Screen Component
export default function ChatScreen() {
  console.log("DEBUG: ChatScreen mounted");

  // --- Hooks and State ---
  const {
    id: sessionIdParam,
    scenarioId: scenarioIdParam,
    isNewSession: isNewSessionParam,
  } = useLocalSearchParams<{
    id?: string;
    scenarioId?: string;
    isNewSession?: string;
  }>();

  const isNewSession = isNewSessionParam === "true";
  const router = useRouter();
  const { state, dispatch } = useChatContext(); // Use context state and dispatch
  // Use selectors for stable references to store state and actions
  const userId = useAppStore(state => state.user?.id);
  const source_language = useAppStore(state => state.source_language);
  const currentSession = useAppStore(state => state.currentSession);
  const currentScenario = useAppStore(state => state.currentScenario);
  const setCurrentSession = useAppStore(state => state.setCurrentSession);
  const setCurrentScenario = useAppStore(state => state.setCurrentScenario);

  const isMountedRef = useRef(true);
  const [showInfo, setShowInfo] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);
  const headerHeight = 80 + insets.top; // Adjust as needed based on ChatHeader actual height
  const [condensedHeader, setCondensedHeader] = useState(false);
  const [inputHeight, setInputHeight] = useState(80); // Initial guess
  const isUserScrollingRef = useRef(false);
  const scrollTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialScrollCompleteRef = useRef(false);

  const listPadding = { paddingBottom: inputHeight + 20 }; // Dynamic padding below list

  // --- Constants ---
  const DAILY_MESSAGE_LIMIT = 20; // Set your desired limit here
  const MAX_INPUT_LENGTH = 500;   // Max characters for user input

  // --- Callbacks ---

  // Scroll to the bottom of the message list
  const scrollToBottom = useCallback((delay = 200, animated = true) => {
      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
      scrollTriggerTimeoutRef.current = setTimeout(() => {
        // Use current state.messages from closure
        if (
          listRef.current &&
          state.messages.length > 0 &&
          !isUserScrollingRef.current &&
          isMountedRef.current
        ) {
          try {
              listRef.current.scrollToOffset({ offset: 999999, animated });
          } catch (error) {
              console.warn("ScrollToBottom error:", error);
          }
        }
      }, delay);
    // Add state.messages.length as dependency to recreate callback when messages change
    }, [state.messages.length]);

  // Handle ending the chat session
  const handleEndChat = useCallback(() => {
    // Use current session from store and messages from context state
    const sessionToEnd = currentSession;
    if (!sessionToEnd) {
      console.warn("handleEndChat called but currentSession is null/undefined in store");
      return;
    }
    // Use messages from context state from closure
    const currentMessages = state.messages;

    Alert.alert(
      "End Conversation",
      "Are you sure you want to end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            // Re-read session state inside onPress in case it changed
             const finalSessionToEnd = useAppStore.getState().currentSession;
             // Read the current context state messages inside the callback
             const finalMessages = state.messages;
            if (!isMountedRef.current || !finalSessionToEnd) return;
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(
                finalSessionToEnd,
                finalMessages, // Use messages from closure
                true, // Mark as completed
                false // Not currently processing a message
              );
              dispatch({ type: "SET_STATUS", payload: "completed" }); // Update local status
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/scenarios");
            } catch (error) {
              if (!isMountedRef.current) return;
              console.error("ChatScreen: Error ending session:", error);
              Alert.alert("Error", "Failed to end conversation. Please try again.");
            } finally {
              if (isMountedRef.current) dispatch({ type: "SET_LOADING", payload: false });
            }
          },
        },
      ]
    );
  // Include state in dependencies to ensure callback has access to latest state
  }, [dispatch, router, currentSession, state.messages]);

  // Handle navigating back (save or end)
  const handleBack = useCallback(() => {
    // Use current session from store and messages from context state
    const sessionToSave = currentSession;
    const currentMessages = state.messages;

    if (!sessionToSave || currentMessages.length === 0) {
      if (router.canGoBack()) router.back();
      else router.replace("/(tabs)/scenarios");
      return;
    }
    Alert.alert(
      "Leave Conversation",
      "Do you want to save and continue later, or end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Save & Continue Later",
          onPress: async () => {
             const finalSessionToSave = useAppStore.getState().currentSession;
             // Read the current context state messages inside the callback
             const finalMessages = state.messages;
            if (!isMountedRef.current || !finalSessionToSave) return;
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(finalSessionToSave, finalMessages, false, false); // Mark as saved
              dispatch({ type: "SET_STATUS", payload: "saved" }); // Update local status
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/scenarios");
            } catch (error) {
              console.error("ChatScreen: Error saving session on back:", error);
              Alert.alert("Error", "Failed to save conversation.");
            } finally {
              if (isMountedRef.current) dispatch({ type: "SET_LOADING", payload: false });
            }
          },
        },
        {
          text: "End Conversation",
          style: "destructive",
          onPress: async () => {
             const finalSessionToEnd = useAppStore.getState().currentSession;
             // Read the current context state messages inside the callback
             const finalMessages = state.messages;
            if (!isMountedRef.current || !finalSessionToEnd) return;
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(finalSessionToEnd, finalMessages, true, false); // Mark as completed
              dispatch({ type: "SET_STATUS", payload: "completed" }); // Update local status
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/scenarios");
            } catch (error) {
               console.error("ChatScreen: Error ending session on back:", error);
               Alert.alert("Error", "Failed to end conversation.");
            } finally {
              if (isMountedRef.current) dispatch({ type: "SET_LOADING", payload: false });
            }
          },
        },
      ]
    );
  // Include state in dependencies to ensure callback has access to latest state
  }, [router, dispatch, currentSession, state.messages]);

  // Handle sending a message
  const handleSend = useCallback(
    async (text: string) => {
      // Use current session, scenario, userId from store hooks
      const sessionToSend = currentSession;
      const scenarioToSend = currentScenario;
      const currentUserId = userId;
      // Access chatContext state directly from closure
      const chatContextState = state;

      // --- Daily Limit Check ---
      if (!currentUserId) {
          console.error("handleSend: Cannot send message, user ID not found.");
          Alert.alert("Error", "Could not verify user. Please restart the app.");
          return;
      }
      try {
          const { allowed, currentCount } = await ProfileService.checkAndIncrementMessageCount(
              currentUserId,
              DAILY_MESSAGE_LIMIT
          );
          if (!allowed) {
              Alert.alert("Daily Limit Reached", `You have reached your daily message limit of ${DAILY_MESSAGE_LIMIT}. Please try again tomorrow.`);
              return;
          }
          console.log(`Message allowed. Current count: ${currentCount}/${DAILY_MESSAGE_LIMIT}`);
      } catch (limitError) {
          console.error("Error checking message limit:", limitError);
          Alert.alert("Error", "Could not verify daily message limit. Please try again.");
          return;
      }
      // --- End Daily Limit Check ---

      // --- Proceed with Sending ---
      const canSend = (chatContextState.status === "active" || chatContextState.status === "saved");
      if (!sessionToSend || !scenarioToSend || !text.trim() || chatContextState.isLoading || !canSend || !isMountedRef.current) {
        console.log("handleSend blocked:", { hasSession: !!sessionToSend, hasScenario: !!scenarioToSend, text: !!text.trim(), isLoading: chatContextState.isLoading, canSend, status: chatContextState.status, isMounted: isMountedRef.current });
        return;
      }
      if (text.length > MAX_INPUT_LENGTH) {
        Alert.alert("Message Too Long", `Please keep your message under ${MAX_INPUT_LENGTH} characters.`);
        return;
      }

      // If resuming a saved session, set status back to active
      if (chatContextState.status === "saved") {
        dispatch({ type: "SET_STATUS", payload: "active" });
        // Update global store session status as well
        setCurrentSession({ ...sessionToSend, status: 'active', lastUpdated: Date.now() });
        console.log("ChatScreen: Status changed from 'saved' to 'active' on send.");
      }

      const userMessageId = generateId();
      const newUserMessage: ChatMessage = {
        id: userMessageId,
        content: { original: text, translated: "..." }, // Placeholder for translation
        sender: "user",
        timestamp: Date.now(),
        isEdited: false,
      };

      // Optimistic UI updates
      dispatch({ type: "SET_LOADING", payload: true }); // Indicate processing starts
      dispatch({ type: "ADD_MESSAGE", payload: newUserMessage });
      Keyboard.dismiss();
      scrollToBottom(100); // Scroll quickly after adding user message

      // Capture state *after* adding user message for saving
      // We need to re-read messages after dispatching ADD_MESSAGE
      // We'll use the current state.messages plus our new message as an optimization
      const messagesAfterUserAdd = [...state.messages, newUserMessage];
      const statusForSave = state.status; // Use current status after potential update
      const sessionAfterUserAdd: Session = {
        ...sessionToSend,
        messages: messagesAfterUserAdd, // Include the new message for local save
        lastUpdated: Date.now(),
        status: statusForSave // Use potentially updated status
      };

      // Save user message state locally immediately
      try {
        await SessionManager.handleSessionUpdate(
          sessionAfterUserAdd,
          messagesAfterUserAdd,
          false // Encryption handled by SessionManager if needed
        );
        console.log(`ChatScreen: Initial local save complete for user message ${userMessageId}`);
      } catch (localSaveError) {
        console.error("ChatScreen: Error saving user message locally:", localSaveError);
      } finally {
        // Set loading false AFTER initial local save, BEFORE long AI call
        if (isMountedRef.current) {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      }

      // --- Background AI processing ---
      const processAIResponse = async () => {
        let aiMessage: ChatMessage | null = null;
        let updatedUserMessageWithTranslation: ChatMessage | null = null;

        try {
          if (!isMountedRef.current) throw new Error("Component unmounted before AI processing");

          // Re-fetch current state inside async function
          const currentSessionForAI = useAppStore.getState().currentSession;
          const currentScenarioForAI = useAppStore.getState().currentScenario;
          if (!currentSessionForAI || !currentScenarioForAI) throw new Error("Session or Scenario missing for AI processing");

          dispatch({ type: "SET_LOADING", payload: true }); // Indicate AI processing started

          // 1. Translate user text
          const translatedUserText = await OpenAIService.translateText(
            text,
            currentSessionForAI.target_language.name
          );
          if (!isMountedRef.current) throw new Error("Component unmounted during user translation");

          // Update the user message in the UI with the translation
          updatedUserMessageWithTranslation = {
            ...newUserMessage,
            content: { original: text, translated: translatedUserText },
          };
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: { id: newUserMessage.id, message: updatedUserMessageWithTranslation },
          });

          // 2. Prepare messages for API call (using state AFTER user message update)
          // We need to capture the messages list *after* the UPDATE_MESSAGE dispatch
          // Access the context state messages directly for re-reading
          const latestMessagesAfterUpdate = state.messages.map((m) =>
            m.id === newUserMessage.id ? updatedUserMessageWithTranslation! : m
          );

          // 3. Call AI
          const aiResponseText = await OpenAIService.generateChatCompletion(
            latestMessagesAfterUpdate,
            currentScenarioForAI,
            currentSessionForAI.target_language.name
          );
          if (!isMountedRef.current) throw new Error("Component unmounted during AI generation");

          // 4. Translate AI response
          const translatedAiText = await OpenAIService.translateText(
            aiResponseText,
            "English" // Assuming target is English for display
          );
          if (!isMountedRef.current) throw new Error("Component unmounted during AI translation");

          aiMessage = {
            id: generateId(),
            content: { original: aiResponseText, translated: translatedAiText },
            sender: "assistant",
            timestamp: Date.now(),
            isEdited: false,
          };

          // 5. Update State, Save, and Sync (if component still mounted)
          if (isMountedRef.current) {
            // Get latest messages state again before adding AI message
            const currentMessagesBeforeAIAdd = state.messages;
            // Ensure user message update is included if it happened
            const updatedMessagesBeforeAIAdd = currentMessagesBeforeAIAdd.map(
              (m) => m.id === newUserMessage.id ? (updatedUserMessageWithTranslation || m) : m
            );
            const finalMessages = [...updatedMessagesBeforeAIAdd, aiMessage];

            dispatch({ type: "ADD_MESSAGE", payload: aiMessage }); // Add AI message to local context

            // Construct final session state for saving/syncing
            const finalSessionState: Session = {
              ...(useAppStore.getState().currentSession || sessionToSend), // Use latest from store or fallback
              messages: finalMessages, // Include AI message
              lastUpdated: Date.now(),
              status: 'active', // Ensure status is active after interaction
            };
            setCurrentSession(finalSessionState); // Update global store

            // Save locally (including AI message)
            await SessionManager.handleSessionUpdate(finalSessionState, finalMessages, false);
            console.log(`ChatScreen: Final local save for ${finalSessionState.id} after AI response`);

            // Attempt final sync
            await SessionManager.syncToSupabase(finalSessionState);
            console.log(`ChatScreen: Final sync attempt for ${finalSessionState.id} finished`);
          }
        } catch (error) {
          console.error("ChatScreen: Error during background AI processing:", error);
          if (isMountedRef.current) {
            Alert.alert("Error", `Failed to get AI response: ${error instanceof Error ? error.message : "Unknown error"}`);
            // Update user message with error state if translation failed or AI failed
            dispatch({
              type: "UPDATE_MESSAGE",
              payload: {
                id: userMessageId,
                message: {
                  ...newUserMessage,
                  content: {
                    original: text,
                    translated: updatedUserMessageWithTranslation?.content.translated ?? "(Translation failed)",
                  },
                  // Optionally add an error flag to the message state
                },
              },
            });
          }
        } finally {
          if (isMountedRef.current) {
            dispatch({ type: "SET_LOADING", payload: false }); // Stop loading indicator
          }
        }
      };

      // Start the background processing without awaiting it
      processAIResponse();
    },
    // Include state in dependencies to ensure callback has access to latest state
    [dispatch, scrollToBottom, userId, currentSession, currentScenario, state, setCurrentSession]
  );
  // --- END handleSend ---


  // --- Effects ---

  // Effect to handle app state changes (backgrounding)
  useEffect(() => {
    console.log("DEBUG: ChatScreen AppState useEffect setup.");
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
        // Read store state using getState, but context state directly from closure
        const session = useAppStore.getState().currentSession;
        const messages = state.messages; // Access from parent closure
        const status = state.status;   // Access from parent closure
        const scenario = useAppStore.getState().currentScenario;
        const currentUserId = useAppStore.getState().user?.id;
        const currentSourceLang = useAppStore.getState().source_language;

        if (
          session &&
          messages.length > 0 &&
          (nextAppState === "background" || nextAppState === "inactive") &&
          status === 'active'
        ) {
          console.log(`ChatScreen: App state changed to ${nextAppState}. Saving session ${session.id}...`);
          const sessionToSaveOnBackground: Session = {
            id: session.id,
            userId: currentUserId || "",
            scenarioId: scenario?.id || "",
            target_language: scenario?.target_language || { code: "en", name: "English", direction: "ltr" },
            source_language: currentSourceLang || { code: "en", name: "English", direction: "ltr" },
            messages: [],
            startTime: session.startTime || Date.now(),
            lastUpdated: Date.now(),
            scenario: scenario || undefined,
            status: 'saved',
          };

          // Call SessionManager without checking isMountedRef inside listener
          SessionManager.handleSessionEnd(sessionToSaveOnBackground, messages, false, false)
            .then(() => console.log(`Session ${session.id} saved on background.`))
            .catch((error) => console.error("SessionManager: Error saving session on app state change:", error));
        }
      }
    );

    isMountedRef.current = true;

    // Cleanup function
    return () => {
      console.log(`\n🚨 DEBUG: ChatScreen AppState Cleanup Triggered! 🚨\n`);
      isMountedRef.current = false;
      appStateSubscription.remove(); // Remove the listener

      // Remove unmount save logic from here - let background listener handle it
      console.log(`DEBUG: ChatScreen Unmount Cleanup - Unmount save logic removed.`);

      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
    };
  // Add state dependencies if we're using it in the listener
  }, [state.messages, state.status]);

  // Effect to load initial chat state
  useEffect(() => {
    let loadTimeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    isMountedRef.current = true;

    // Get stable references or values needed inside async function
    const currentSourceLang = source_language; // Use value from hook scope
    const routerRef = router;
    const dispatchRef = dispatch;
    const setCurrentScenarioRef = setCurrentScenario;
    const setCurrentSessionRef = setCurrentSession;


    async function loadChatState() {
        console.log("DEBUG: Loading useEffect starting...");
        const sessionId = typeof sessionIdParam === "string" ? sessionIdParam : undefined;
        const scenarioId = typeof scenarioIdParam === "string" ? scenarioIdParam : undefined;

        // --- Essential Checks ---
        if (!sessionId || !scenarioId) {
            console.error("ChatScreen: Missing session ID or scenario ID parameter.");
            if(isMounted) Alert.alert("Error", "Could not load chat session (missing ID).");
            if(routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(tabs)/scenarios");
            return;
        }
        // userId is included in dependency array, so it's stable here
        if (!userId) {
            console.error("ChatScreen: User ID not available.");
            if(isMounted) Alert.alert("Error", "User information not available.");
            if(routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(auth)/login");
            return;
        }
        if (isNewSession && !currentSourceLang) { // Use source lang fetched inside effect
            console.error("ChatScreen: Source language not available for new session.");
             if(isMounted) Alert.alert("Error", "Default language information not available.");
            if(routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(tabs)/scenarios");
            return;
        }
        // --- End Checks ---

        console.log(`DEBUG: loadChatState - Attempting load/create for session ${sessionId}, scenario ${scenarioId}, User: ${userId}, isNew: ${isNewSession}`);
        try {
          if (isMounted) {
            dispatchRef({ type: "SET_LOADING", payload: true });
            dispatchRef({ type: "LOAD_MESSAGES", payload: [] });
            dispatchRef({ type: "SET_STATUS", payload: "active" });
            console.log("DEBUG: Initial Dispatches (LOADING, LOAD_MESSAGES[], STATUS active)");
          }

          console.log(`DEBUG: Calling SessionManager.loadOrCreateSession for ${sessionId}`);
          const result = await SessionManager.loadOrCreateSession(
            sessionId, scenarioId, userId, isNewSession, currentSourceLang, dispatchRef
          );
          console.log(`DEBUG: SessionManager.loadOrCreateSession call completed for ${sessionId}`);

          if (!isMounted) { console.log("DEBUG: Component unmounted during load/create"); return; }

          if (result && result.session && result.scenario) {
            const { session: loadedSession, scenario: loadedScenario, messages: loadedMessages } = result;
            console.log(`DEBUG: Loaded/Created Session Status: ${loadedSession.status}, Messages: ${loadedMessages.length}`);

            // Dispatch updates to context
            dispatchRef({ type: "SET_SESSION", payload: loadedSession.id });
            dispatchRef({ type: "LOAD_MESSAGES", payload: loadedMessages });
            dispatchRef({ type: "SET_STATUS", payload: loadedSession.status });

            // Update global store using stable refs
            setCurrentScenarioRef(loadedScenario);
            setCurrentSessionRef(loadedSession);
            console.log("DEBUG: Global State updates complete.");

            // Schedule scroll to bottom logic
            loadTimeoutId = setTimeout(() => {
              if (listRef.current && isMountedRef.current) {
                scrollToBottom(0, false);
              }
              initialScrollCompleteRef.current = true;
            }, 300);
          } else {
            console.error(`DEBUG: loadChatState - Failed to load/create session or scenario from SessionManager for session ${sessionId}`);
            if(isMounted) Alert.alert("Error", "Failed to initialize chat session details.");
            if (routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(tabs)/scenarios");
          }
        } catch (error) {
          if (!isMounted) return;
          console.error(`DEBUG: loadChatState - Error loading/creating state for session ${sessionId}:`, error);
          if(isMounted) Alert.alert("Error Loading Chat", error instanceof Error ? error.message : "An unknown error occurred.");
          if (routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(tabs)/scenarios");
        } finally {
          if (isMounted) {
            dispatchRef({ type: "SET_LOADING", payload: false });
            console.log("DEBUG: Loading useEffect finished (finally block - loading set false).");
          }
        }
      }

    loadChatState();

    // Cleanup function
    return () => {
      console.log("DEBUG: Loading useEffect cleanup running.");
      isMounted = false;
      isMountedRef.current = false;
      if (loadTimeoutId) {
        clearTimeout(loadTimeoutId);
      }
    };
  // STABILIZED Dependencies: Only re-run if the core identifiers change.
  }, [ sessionIdParam, scenarioIdParam, isNewSessionParam, userId, dispatch, router, setCurrentScenario, setCurrentSession, source_language ]);

  // Effect to scroll when new messages are added (after initial load)
  useEffect(() => {
    if (
      state.messages.length > 0 &&
      initialScrollCompleteRef.current &&
      !isUserScrollingRef.current
    ) {
      scrollToBottom(300, true); // Scroll animated after initial load
    }
  // Depend on state.messages.length and the stable scrollToBottom callback
  }, [state.messages.length, scrollToBottom]);

  // --- List Optimization ---
  const getItemLayout = useCallback((data: any, index: number) => {
    const ESTIMATED_ITEM_HEIGHT = 80; // Adjust based on average bubble height
    return {
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index
    };
  }, []);

  // --- Render Logic ---

  // Loading state display
  if (state.isLoading && (state.messages.length === 0 || !currentScenario)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Body1 style={{ marginTop: 20 }}>Loading conversation...</Body1>
      </View>
    );
  }

  // Main screen render
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatHeader
        title={currentScenario?.title ?? "Loading Scenario..."}
        subtitle={currentSession?.target_language?.name ?? "..."}
        onBack={handleBack}
        onInfo={() => currentScenario && setShowInfo(true)}
        onEndChat={handleEndChat}
        canEndChat={state.status === "active" && state.messages.length > 0}
        condensed={condensedHeader}
      />

      {/* Banner for ended sessions */}
      {state.status === "completed" && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>Conversation Ended</Text>
          <ChatButton
            variant="secondary"
            onPress={() => router.replace("/(tabs)/scenarios")}
            style={styles.statusBannerButton}
          >
             <Text style={styles.statusBannerButtonText}>Start New</Text>
          </ChatButton>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={listRef}
        data={state.messages} // Use messages from context state
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<ChatMessage>) => <ChatBubble message={item} />} // Typed renderItem
        contentContainerStyle={[
          styles.messagesList,
          { paddingTop: headerHeight + (state.status === "completed" ? 60 : 20) }, // Adjust padding based on banner
          listPadding, // Dynamic bottom padding based on input height
        ]}
        // User interaction handlers for scroll management
        onScrollBeginDrag={() => { isUserScrollingRef.current = true; }}
        onMomentumScrollEnd={() => { setTimeout(() => { isUserScrollingRef.current = false; }, 300); }}
        // Update header condensation based on scroll position
        onScroll={(event) => { setCondensedHeader(event.nativeEvent.contentOffset.y > 50); }}
        scrollEventThrottle={16}
        ListEmptyComponent={ // Show prompt if list is empty and not loading
          !state.isLoading ? (
            <View style={styles.emptyChat}>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={40} color={theme.colors.text.hint} />
              </View>
              <Body1 color={theme.colors.text.secondary} style={styles.emptyChatText}>
                Start the conversation by sending a message.
              </Body1>
            </View>
          ) : null // Don't show empty state while loading initially
        }
        getItemLayout={getItemLayout} // Performance optimization
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        keyboardDismissMode="interactive" // Allow dismissing keyboard by dragging list
        keyboardShouldPersistTaps="handled" // Handle taps inside ScrollView
        inverted={false} // Keep messages in chronological order (standard chat)
      />


      {/* Input Area */}
      <View
        style={styles.inputWrapper}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height !== inputHeight) setInputHeight(height); // Update padding based on input height
        }}
      >
        <ChatInput
          onSend={handleSend}
          loading={state.isLoading}
          targetLanguageName={currentSession?.target_language?.name ?? ""}
          status={state.status} // Pass status from context
          maxLength={MAX_INPUT_LENGTH}
        />
      </View>

      {/* Scenario Info Modal */}
      <ScenarioInfoCard
        scenario={currentScenario} // Use scenario from store
        isVisible={showInfo}
        onClose={() => setShowInfo(false)}
      />
    </View>
  );
} // End of ChatScreen component

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB", // Use a slightly off-white background
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  // Header Styles
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    // Removed borderBottomWidth for BlurView effect
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1, // Ensure content takes full height available within header bounds
    paddingHorizontal: 16,
    // paddingBottom: 8, // Adjust padding as needed
  },
  backButton: {
    padding: 8, // Add padding for easier tapping
    marginRight: 8,
    marginLeft: -8, // Offset padding
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: 'center', // Center title/subtitle
    marginHorizontal: 8, // Add margin to prevent overlap with buttons
  },
  headerTitle: {
    textAlign: "center",
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  endChatHeaderButton: {
    padding: 8,
    marginRight: 4,
  },
  infoButton: {
    padding: 8,
    marginLeft: 4, // Reduced margin
  },
  // Status Banner Styles
  statusBanner: {
    position: "absolute",
    top: 100, // Adjust based on header height
    left: 16,
    right: 16,
    backgroundColor: "#FEF2F2", // Light red background
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    color: "#B91C1C", // Darker red text
    fontSize: 14,
    fontWeight: "500",
  },
   statusBannerButton: {
       paddingVertical: 4,
       paddingHorizontal: 12,
       height: 32,
       backgroundColor: 'rgba(220, 38, 38, 0.1)', // Lighter red background for button
       borderRadius: 16,
   },
   statusBannerButtonText: {
       fontSize: 14,
       color: '#DC2626', // Red text for button
       fontWeight: '500',
   },
  // Messages List Styles
  messagesList: {
    paddingHorizontal: 16,
    flexGrow: 1, // Ensure it can grow to push input down
  },
  emptyChat: {
    flex: 1, // Take remaining space
    justifyContent: 'center', // Center vertically
    alignItems: "center",
    padding: 20,
    marginTop: 100, // Adjust as needed
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#F3F4F6", // Light gray background
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyChatText: {
    textAlign: "center",
    maxWidth: 250,
  },
  // Input Area Styles
  inputWrapper: {
    // Position fixed at bottom handled by layout, not absolute positioning
    backgroundColor: "#fff", // White background for input area
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
    // Removed shadow for a flatter look, adjust if needed
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    // paddingBottom handled by safe area in ChatInput
  },
  languageIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
    alignSelf: 'flex-start', // Align to the left
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end", // Align items to bottom (for multiline input)
    gap: 8,
  },
  textInputContainer: {
    flex: 1,
    minHeight: 44, // Ensure minimum tap height
    maxHeight: 120, // Limit expansion
    borderRadius: 22, // Fully rounded corners
    borderWidth: 1,
    borderColor: "#E5E7EB", // Light gray border
    backgroundColor: "#F9FAFB", // Off-white background
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8, // Adjust padding for platform
    flexDirection: "row",
    alignItems: "center", // Center single-line text vertically
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B', // Darker text
    paddingTop: 0, // Remove default padding
    paddingBottom: 0,
    // maxHeight handled by container
  },
  voiceButton: { // Placeholder style
    padding: 8,
    marginLeft: 4,
  },
  sendButton: {
    width: 44, // Circular button
    height: 44,
    borderRadius: 22, // Fully rounded
    justifyContent: "center",
    alignItems: "center",
    // backgroundColor set by ChatButton variant
  },
  // Scenario Info Card Styles
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
    paddingBottom: 34, // Add padding for safe area
    maxHeight: "80%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
  },
  infoCardHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#CBD5E1", // Lighter handle color
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  infoCardTitle: {
    marginBottom: 8,
    textAlign: 'center',
  },
  infoCardDescription: {
    marginBottom: 24,
    opacity: 0.8,
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18, // Slightly smaller section title
    color: '#374151', // Darker gray
  },
  personaSection: {
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  personaContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
  },
  personaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4A6FFF", // Example color, use theme if available
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  personaDetails: {
    flex: 1,
  },
  personalityText: {
    marginBottom: 16,
    fontStyle: 'italic',
    color: '#6B7280',
  },
  infoTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12, // Increased gap
  },
  infoTag: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: '#F3F4F6',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  closeButton: {
    alignSelf: "center",
    minWidth: 120,
    marginTop: 24, // Increased margin
  },
  // Chat Button Styles (Basic)
  chatButtonBase: {
      height: 44,
      borderRadius: 22,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 16,
      flexDirection: 'row',
  },
  chatButtonText: {
      fontWeight: '600',
      fontSize: 16,
  },
});