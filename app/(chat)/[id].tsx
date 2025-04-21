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
// --- [MODIFY] Import useLocalSearchParams ---
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
import { Dispatch } from "react"; // Kept, though dispatch from context is used primarily
import { OpenAIService } from "@/lib/services/openai";
import { generateId } from "@/lib/utils/ids";
import { Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  // useAnimatedStyle, // Keep if needed by components below
  // withTiming, // Keep if needed by components below
} from "react-native-reanimated";
import { BlurView } from "expo-blur";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// --- Keep ChatButton, ChatInput, ChatHeader, ScenarioInfoCard components ---
// Assume these components have props defined within their actual implementation
// For this example, we use placeholder props for clarity
const ChatButton = ({
  onPress,
  disabled,
  loading,
  style,
  icon,
  variant = "primary",
  children,
}: any) => {
  // Using 'any' for brevity in this example; define proper props in actual implementation
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

const ChatInput = ({
  onSend,
  // disabled = false, // We now calculate disable based on status
  loading = false,
  targetLanguageName = "",
  status, // Added status prop
  maxLength, // Added maxLength prop
}: any) => {
  // Using 'any' for brevity; define proper props
  const [text, setText] = useState("");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null); // Specify TextInput type for ref
  
  const isDisabled = status !== 'active' && status !== 'saved'; // Calculate disable based on status
  const handleSend = () => {
    if (!text.trim() || isDisabled || loading) return;
    onSend(text.trim());
    setText("");
  };

  // --- MODIFIED PLACEHOLDER LOGIC ---
  const getPlaceholderText = () => {
    if (status === 'completed') {
      return "Chat session ended";
    } else if (status === 'saved') {
      return "Chat saved"; // Or "Chat paused", or ""
    } else { // status === 'active' or default
      return "Type a message...";
    }
  };
  // --- END MODIFIED PLACEHOLDER LOGIC ---
  return (
    <View
      style={[
        styles.inputContainer, // Defined in styles below
        { paddingBottom: Math.max(insets.bottom, 12) },
      ]}
    >
      {targetLanguageName && (
        <View style={styles.languageIndicator}>
          <Feather name="globe" size={12} color={theme.colors.text.secondary} />
          <Caption
            color={theme.colors.text.secondary}
            style={{ marginLeft: 4 }}
          >
            Speaking in {targetLanguageName}
          </Caption>
        </View>
      )}
      <View style={styles.inputRow}>
        <View
          style={[styles.textInputContainer, isDisabled && styles.disabledInput]}
        >
          <AnimatedTextInput
            ref={inputRef}
            style={styles.textInput}
            // --- USE THE NEW FUNCTION FOR PLACEHOLDER ---
            placeholder={getPlaceholderText()}
            // --- END PLACEHOLDER CHANGE ---
            placeholderTextColor={theme.colors.text.hint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={maxLength} // Use the passed maxLength prop
            // --- MODIFICATION: Allow editing in 'saved' state ---
            editable={!isDisabled && !loading}
            scrollEnabled={true} // Ensure scroll is enabled if needed
          />
          <TouchableOpacity
            style={styles.voiceButton}
            disabled={isDisabled || loading}
            // onPress={/* Add voice input handler */}
          >
            <Feather
              name="mic"
              size={20}
              color={
                isDisabled
                  ? theme.colors.text.disabled
                  : theme.colors.primary.main
              }
            />
          </TouchableOpacity>
        </View>
        <ChatButton
          variant="primary"
          icon="send"
          style={[styles.sendButton, { width: 44, height: 44 }]}
          disabled={!text.trim() || isDisabled || loading} // Use calculated disable
          onPress={handleSend}
          loading={loading}
        />
      </View>
    </View>
  );
};

const ChatHeader = ({
  title,
  subtitle,
  onBack,
  onInfo,
  onEndChat,
  canEndChat,
  condensed,
}: any) => {
  // Using 'any' for brevity; define proper props
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Animated.View
      style={[
        styles.header, // Defined in styles below
        {
          height: condensed ? 60 + insets.top : 80 + insets.top,
          paddingTop: insets.top,
        },
      ]}
    >
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={95} />
      <View style={styles.headerContent}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Feather
            name="chevron-left"
            size={24}
            color={theme.colors.primary.main}
          />
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
            <TouchableOpacity
              style={styles.endChatHeaderButton}
              onPress={onEndChat}
            >
              <Feather name="x-circle" size={20} color="#E53E3E" />
            </TouchableOpacity>
          )}
          {onInfo && (
            <TouchableOpacity style={styles.infoButton} onPress={onInfo}>
              <Feather
                name="info"
                size={20}
                color={theme.colors.primary.main}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

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
      style={[styles.infoCardContainer]} // Defined in styles below
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      {/* Background Blur and Close Trigger */}
      <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </BlurView>

      {/* Card Content */}
      <Animated.View style={styles.infoCard} entering={SlideInUp.springify()}>
        {/* Handle */}
        <View style={styles.infoCardHandle} />

        {/* Basic Info */}
        <Heading3 style={styles.infoCardTitle}>
          {scenario.title ?? "Scenario Title"}
        </Heading3>
        <Body1 style={styles.infoCardDescription}>
          {scenario.description ?? "No description available."}
        </Body1>

        {/* Persona Section - Added optional chaining for safety */}
        <View style={styles.personaSection}>
          <Heading3 style={styles.sectionTitle}>Conversation Partner</Heading3>
          <View style={styles.personaContainer}>
            <View style={styles.personaAvatar}>
              <Feather name="user" size={24} color="#fff" />
            </View>
            <View style={styles.personaDetails}>
              <Body1 weight="semibold">
                {scenario.persona?.name ?? "Unknown"}
              </Body1>
              <Body2 color={theme.colors.text.secondary}>
                {scenario.persona?.role ?? "Unknown Role"}
              </Body2>
            </View>
          </View>
          <Body1 style={styles.personalityText}>
            {scenario.persona?.personality ?? "No personality description."}
          </Body1>

          {/* Tags Section */}
          <View style={styles.infoTags}>
            <View style={styles.infoTag}>
              <Caption>Style: </Caption>
              <Caption weight="semibold" style={{ marginLeft: 4 }}>
                {scenario.persona?.languageStyle ?? "N/A"}
              </Caption>
            </View>
            <View style={styles.infoTag}>
              <Caption>Difficulty: </Caption>
              <Caption weight="semibold" style={{ marginLeft: 4 }}>
                {scenario.difficulty ?? "N/A"}
              </Caption>
            </View>
            <View style={styles.infoTag}>
              <Caption>Language: </Caption>
              <Caption weight="semibold" style={{ marginLeft: 4 }}>
                {scenario.target_language?.name ?? "N/A"}
              </Caption>
            </View>
          </View>
        </View>

        {/* Close Button */}
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
// --- End Kept Components ---

// Main Chat Screen Component
export default function ChatScreen() {
  console.log("DEBUG: ChatScreen mounted");

  // --- [MODIFY] Read new params from navigation ---
  const {
    id: sessionIdParam, // Renamed from id for clarity
    scenarioId: scenarioIdParam,
    isNewSession: isNewSessionParam,
  } = useLocalSearchParams<{
    id?: string;
    scenarioId?: string;
    isNewSession?: string;
  }>();

  // Convert string param back to boolean, default to false if undefined
  const isNewSession = isNewSessionParam === "true";

  const router = useRouter();
  const { state, dispatch } = useChatContext();

  // --- [MODIFIED] Extract primitive values from useAppStore ---
  const userId = useAppStore((state) => state.user?.id);
  const sourceLangCode = useAppStore((state) => state.source_language?.code);
  const sourceLangName = useAppStore((state) => state.source_language?.name);

  // --- [KEEP] Still need these for UI and other operations ---
  const {
    currentSession, // Read for potential use (e.g., in handleSend, cleanup)
    currentScenario, // Read for potential use (e.g., header display, handleSend)
    setCurrentSession, // Setter
    setCurrentScenario, // Setter
    source_language, // Needed for creating new sessions
  } = useAppStore();

  // --- Keep existing state hooks and refs ---
  const isMountedRef = useRef(true);
  const [showInfo, setShowInfo] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);
  const headerHeight = 80 + insets.top;
  const [condensedHeader, setCondensedHeader] = useState(false);
  const [inputHeight, setInputHeight] = useState(80); // Initial guess, will be updated by onLayout
  const isUserScrollingRef = useRef(false);
  const scrollTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialScrollCompleteRef = useRef(false);
  // Removed prevSessionId, prevMessageCount, prevStatus refs as direct comparisons in cleanup are better
  // --- End Keep State/Refs ---

  const listPadding = { paddingBottom: inputHeight + 20 };

  // --- Keep scrollToBottom but memoize only on state.messages.length ---
  const scrollToBottom = useCallback(
    (delay = 200, animated = true) => {
      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
      scrollTriggerTimeoutRef.current = setTimeout(() => {
        // Check listRef and messages length *inside* timeout to ensure they are current
        if (
          listRef.current &&
          state.messages.length > 0 &&
          !isUserScrollingRef.current
        ) {
          listRef.current.scrollToOffset({ offset: 999999, animated }); // Use a large offset
        }
      }, delay);
    },
    [state.messages.length] // Dependency: only need length to decide if scrolling is possible
  );

  // --- Keep AppState/Cleanup effect (ensure dependencies are minimal and correct) ---
  useEffect(() => {
    console.log("DEBUG: ChatScreen AppState useEffect setup.");
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextAppState) => {
        // Use current values from store/context *at the time of the state change*
        const session = currentSession; // Get session from store
        const messages = state.messages; // Get messages from context
        const status = state.status; // Get status from context
        const isLoading = state.isLoading; // Get loading state from context
        const scenario = currentScenario; // Get scenario from store

        if (
          session &&
          messages.length > 0 &&
          (nextAppState === "background" || nextAppState === "inactive")
        ) {
          console.log(
            `ChatScreen: App state changed to ${nextAppState}. Saving session ${session.id}...`
          );
          // Reconstruct a minimal session object needed for saving
          const sessionToSaveOnBackground: Session = {
            id: session.id,
            userId: userId || "", // Use extracted primitive userId
            scenarioId: scenario?.id || "", // Provide default or handle missing scenario
            target_language: scenario?.target_language || {
              code: "en",
              name: "English",
            }, // Use actual target language
            source_language: source_language || { code: "en", name: "English" }, // Use actual source language
            messages: [], // Messages passed separately
            startTime: session.startTime || Date.now(),
            lastUpdated: Date.now(), // Update timestamp
            scenario: scenario || undefined, // Attach scenario if available
            status: status, // Current status from context
          };

          if (isMountedRef.current) {
            // Pass false for 'markAsCompleted', true for 'isProcessing' if applicable (or false here)
            SessionManager.handleSessionEnd(
              sessionToSaveOnBackground,
              messages,
              false,
              isLoading
            ).catch((error) =>
              console.error(
                "SessionManager: Error saving session on app state change:",
                error
              )
            );
          }
        }
      }
    );

    // Store initial values for comparison in cleanup log - Capture specific values from the store/context
    const initialSessionIdForCleanup = currentSession?.id;
    const initialMessagesLengthForCleanup = state.messages.length; // Store length for simpler comparison
    const initialStatusForCleanup = state.status;
    const initialIsLoadingForCleanup = state.isLoading;

    isMountedRef.current = true;

    // Cleanup function
    return () => {
      // Use current values from store/context *at the time of cleanup*
      const sessionAtCleanup = currentSession;
      const messagesAtCleanup = state.messages;
      const statusAtCleanup = state.status;
      const isLoadingAtCleanup = state.isLoading;
      const scenarioAtCleanup = currentScenario;

      let triggerReason = "Component Unmount";
      // Compare CURRENT values with initial values captured when effect ran
      if (sessionAtCleanup?.id !== initialSessionIdForCleanup) {
        triggerReason = `currentSession?.id changed (prev: ${initialSessionIdForCleanup}, new: ${sessionAtCleanup?.id})`;
      } else if (messagesAtCleanup.length !== initialMessagesLengthForCleanup) {
        triggerReason = `state.messages.length changed (prev: ${initialMessagesLengthForCleanup}, new: ${messagesAtCleanup.length})`;
      } else if (statusAtCleanup !== initialStatusForCleanup) {
        triggerReason = `state.status changed (prev: ${initialStatusForCleanup}, new: ${statusAtCleanup})`;
      } else if (isLoadingAtCleanup !== initialIsLoadingForCleanup) {
        triggerReason = `state.isLoading changed (prev: ${initialIsLoadingForCleanup}, new: ${isLoadingAtCleanup})`;
      }
      // Add other relevant comparisons if needed

      console.log(
        `\n🚨 DEBUG: ChatScreen AppState Cleanup Triggered! Reason: ${triggerReason} 🚨\n`
      );

      isMountedRef.current = false;
      appStateSubscription.remove();

      // --- TEMPORARILY COMMENT OUT SessionManager CALL IN AppState CLEANUP ---
      
      if (sessionAtCleanup && messagesAtCleanup?.length > 0) {
        console.log(`DEBUG: ChatScreen AppState Cleanup - Saving session ${sessionAtCleanup.id}...`);
        // Reconstruct session based on state values captured *at cleanup time*
        const sessionToSaveOnUnmount: Session = {
          id: sessionAtCleanup.id,
          userId: userId || "",
          scenarioId: scenarioAtCleanup?.id || "",
          target_language: scenarioAtCleanup?.target_language || { code: "en", name: "English" },
          source_language: source_language || { code: "en", name: "English" },
          messages: [], // Passed separately
          startTime: sessionAtCleanup.startTime || Date.now(),
          lastUpdated: Date.now(),
          scenario: scenarioAtCleanup || undefined,
          status: statusAtCleanup, // Status at cleanup time
        };
  
        // Save with the state captured just before unmounting
        SessionManager.handleSessionEnd(sessionToSaveOnUnmount, messagesAtCleanup, false, isLoadingAtCleanup)
          .catch((error) => console.error("SessionManager: Error saving session on AppState cleanup:", error));
      }
      console.log(
        "DEBUG: ChatScreen AppState Cleanup - SessionManager call TEMPORARILY DISABLED."
      );

      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
    };
  }, [
    userId,
    sourceLangCode,
    state.messages,
    state.status,
    state.isLoading,
    currentSession,
    currentScenario,
    dispatch,
  ]);

  // --- [MODIFIED] Initial chat state loading effect with stabilized dependencies ---
  // --- IMPORTANT: REMOVED scrollToBottom from dependencies array ---
  useEffect(() => {
    let loadTimeoutId: NodeJS.Timeout | null = null;
    let isMounted = true; // Use local mount flag for this effect
    isMountedRef.current = true; // Also set the main mount ref

    async function loadChatState() {
        console.log("DEBUG: Loading useEffect starting...");
      
        const sessionId =
          typeof sessionIdParam === "string" ? sessionIdParam : undefined;
        const scenarioId =
          typeof scenarioIdParam === "string" ? scenarioIdParam : undefined;
      
        // --- Essential Checks ---
        if (!sessionId || !scenarioId) {
          console.error(
            "ChatScreen: Missing session ID or scenario ID parameter.",
            { sessionIdParam, scenarioIdParam }
          );
          if (isMounted)
            Alert.alert("Error", "Could not load chat session (missing ID).");
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/scenarios");
          return;
        }
        if (!userId) {
          console.error("ChatScreen: User ID not available.");
          if (isMounted) Alert.alert("Error", "User information not available.");
          if (router.canGoBack()) router.back();
          else router.replace("/(auth)/login");
          return;
        }
        if (isNewSession && !sourceLangCode) {
          console.error(
            "ChatScreen: Source language not available for new session."
          );
          if (isMounted)
            Alert.alert("Error", "Default language information not available.");
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/scenarios");
          return;
        }
        // --- End Checks ---
      
        console.log(
          `DEBUG: loadChatState - Attempting load/create for session ${sessionId}, scenario ${scenarioId}, User: ${userId}, isNew: ${isNewSession}`
        );
        try {
          if (isMounted) {
            // --- Re-enable Initial Dispatches ---
            dispatch({ type: "SET_LOADING", payload: true });
            dispatch({ type: "LOAD_MESSAGES", payload: [] }); 
            dispatch({ type: "SET_STATUS", payload: "active" });
            console.log(
              "DEBUG: [ENABLED] Initial Dispatches (LOADING, LOAD_MESSAGES[], STATUS active)"
            );
            // --- End Re-enable ---
          }
      
          console.log(
            `DEBUG: Calling SessionManager.loadOrCreateSession for ${sessionId}`
          );
          const result = await SessionManager.loadOrCreateSession(
            sessionId,
            scenarioId,
            userId,
            isNewSession,
            isNewSession ? source_language : null,
            dispatch 
          );
          console.log(
            `DEBUG: SessionManager.loadOrCreateSession call completed for ${sessionId}`
          );
      
          if (!isMounted) {
            console.log("DEBUG: Component unmounted during load/create");
            return;
          }
      
          if (result && result.session && result.scenario) {
            const {
              session: loadedSession,
              scenario: loadedScenario,
              messages: loadedMessages,
            } = result;
            console.log(
              `DEBUG: Loaded/Created Session Status: ${loadedSession.status}, Messages: ${loadedMessages.length}`
            );
      
            dispatch({ type: "SET_SESSION", payload: loadedSession.id });
            console.log("DEBUG: SET_SESSION dispatched.");
      
            // --- Load messages immediately with logs ---
            if (isMountedRef.current) {
              console.log(`DEBUG: About to dispatch LOAD_MESSAGES with ${loadedMessages.length} messages at ${new Date().toISOString()}`);
              dispatch({ type: "LOAD_MESSAGES", payload: loadedMessages });
              console.log(`DEBUG: LOAD_MESSAGES dispatch completed at ${new Date().toISOString()}`);
            }
      
            dispatch({ type: "SET_STATUS", payload: loadedSession.status });
            console.log("DEBUG: SET_STATUS dispatched.");
      
            setCurrentScenario(loadedScenario);
            setCurrentSession(loadedSession);
            console.log("DEBUG: Global State updates enabled.");
      
            // Schedule scroll to bottom logic
            loadTimeoutId = setTimeout(() => {
              if (listRef.current) {
                scrollToBottom(0, false);
              }
              initialScrollCompleteRef.current = true;
            }, 300);
          } else {
            console.error(
              `DEBUG: loadChatState - Failed to load/create session or scenario from SessionManager for session ${sessionId}`
            );
            Alert.alert("Error", "Failed to initialize chat session details.");
            if (router.canGoBack()) router.back();
            else router.replace("/(tabs)/scenarios");
          }
        } catch (error) {
          if (!isMounted) return;
          console.error(
            `DEBUG: loadChatState - Error loading/creating state for session ${sessionId}:`,
            error
          );
          Alert.alert(
            "Error Loading Chat",
            error instanceof Error ? error.message : "An unknown error occurred."
          );
          if (router.canGoBack()) router.back();
          else router.replace("/(tabs)/scenarios");
        } finally {
          if (isMounted) {
            dispatch({ type: "SET_LOADING", payload: false });
            console.log(
              "DEBUG: Loading useEffect finished (finally block - loading set false)."
            );
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
      // Keep SessionManager call commented out in this cleanup
      console.log(
        "DEBUG: ChatScreen Loading Cleanup - SessionManager call TEMPORARILY DISABLED."
      );
    };
    // FIXED: Removed scrollToBottom from dependencies array
  }, [
    sessionIdParam,
    scenarioIdParam,
    isNewSessionParam,
    userId,
    sourceLangCode,
    dispatch,
    router,
    setCurrentScenario,
    setCurrentSession,
    source_language, // Added for completeness
  ]);

  // --- Separate effect for scrolling based on messages changes ---
  useEffect(() => {
    if (
      state.messages.length > 0 &&
      initialScrollCompleteRef.current &&
      !isUserScrollingRef.current
    ) {
      scrollToBottom(300, true);
    }
  }, [state.messages.length, scrollToBottom]);

  // --- Added getItemLayout function for FlatList optimization ---
  const getItemLayout = useCallback((data: any, index: number) => {
    // Use an estimated average message height - adjust based on your ChatBubble's typical dimensions
    const ESTIMATED_ITEM_HEIGHT = 80;
    return { 
      length: ESTIMATED_ITEM_HEIGHT, 
      offset: ESTIMATED_ITEM_HEIGHT * index, 
      index 
    };
  }, []);

  const handleEndChat = useCallback(() => {
    const sessionToEnd = currentSession; // Capture session from store at call time
    if (!sessionToEnd) {
      console.warn(
        "handleEndChat called but currentSession is null/undefined in store"
      );
      return;
    }
    Alert.alert(
      "End Conversation",
      "Are you sure you want to end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            if (!isMountedRef.current || !sessionToEnd) return; // Re-check sessionToEnd
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              // Pass the captured session state for saving
              // Use state.messages from context for the current message list
              await SessionManager.handleSessionEnd(
                sessionToEnd,
                state.messages,
                true,
                false
              ); // Mark as completed
              dispatch({ type: "SET_STATUS", payload: "completed" });
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/scenarios");
            } catch (error) {
              if (!isMountedRef.current) return;
              console.error("ChatScreen: Error ending session:", error);
              Alert.alert(
                "Error",
                "Failed to end conversation. Please try again."
              );
            } finally {
              if (isMountedRef.current)
                dispatch({ type: "SET_LOADING", payload: false });
            }
          },
        },
      ]
    );
  }, [currentSession, state.messages, dispatch, router]); // Depend on currentSession from store

  const handleBack = useCallback(() => {
    const sessionToSave = currentSession; // Capture session from store at call time
    if (!sessionToSave || state.messages.length === 0) {
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
            if (!isMountedRef.current || !sessionToSave) return; // Re-check captured session
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(
                sessionToSave,
                state.messages,
                false,
                false
              ); // Mark as saved
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/scenarios");
            } catch (error) {
              if (!isMountedRef.current) return;
              console.error("ChatScreen: Error saving session on back:", error);
              Alert.alert(
                "Error",
                "Failed to save conversation. Please try again."
              );
            } finally {
              if (isMountedRef.current)
                dispatch({ type: "SET_LOADING", payload: false });
            }
          },
        },
        {
          text: "End Conversation",
          style: "destructive",
          onPress: async () => {
            if (!isMountedRef.current || !sessionToSave) return; // Re-check captured session
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(
                sessionToSave,
                state.messages,
                true,
                false
              ); // Mark as completed
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)/scenarios");
            } catch (error) {
              if (!isMountedRef.current) return;
              console.error("ChatScreen: Error ending session on back:", error);
              Alert.alert(
                "Error",
                "Failed to end conversation. Please try again."
              );
            } finally {
              if (isMountedRef.current)
                dispatch({ type: "SET_LOADING", payload: false });
            }
          },
        },
      ]
    );
  }, [currentSession, state.messages, router, dispatch]); // Depend on currentSession from store

  const MAX_INPUT_LENGTH = 500; // Character limit for messages

  const handleSend = useCallback(
    async (text: string) => {
      // Use currentSession and currentScenario from useAppStore directly
      const sessionToSend = currentSession;
      const scenarioToSend = currentScenario;

      // --- MODIFICATION: Allow sending in 'saved' state ---
      const canSend = (state.status === "active" || state.status === "saved");

      if (
        !sessionToSend ||
        !scenarioToSend ||
        !text.trim() ||
        state.isLoading ||
        !canSend || // Use the new check
        !isMountedRef.current
      ) {
        console.log("handleSend blocked:", {
          hasSession: !!sessionToSend,
          hasScenario: !!scenarioToSend,
          text: !!text.trim(),
          isLoading: state.isLoading,
          canSend, // Log the check result
          status: state.status,
          isMounted: isMountedRef.current,
        });
        return;
      }

      // --- ADD INPUT LENGTH CHECK ---
      if (text.length > MAX_INPUT_LENGTH) {
        Alert.alert(
          "Message Too Long",
          `Please keep your message under ${MAX_INPUT_LENGTH} characters.`
        );
        return; // Stop processing
      }
      // --- END INPUT LENGTH CHECK ---

      // If the status was 'saved', set it back to 'active' optimistically
      if (state.status === "saved") {
        dispatch({ type: "SET_STATUS", payload: "active" });
        console.log("ChatScreen: Status changed from 'saved' to 'active' on send.");
        // Optionally update the session object in useAppStore immediately too
        if (sessionToSend) {
          setCurrentSession({ ...sessionToSend, status: 'active', lastUpdated: Date.now() });
        }
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
      const messagesAfterUserAdd = [...state.messages, newUserMessage];
      // Update session object with new message list and timestamp for saving
      // *** Ensure status is 'active' if it was changed ***
      const statusForSave = state.status === 'saved' ? 'active' : state.status;
      const sessionAfterUserAdd: Session = {
        ...sessionToSend,
        messages: messagesAfterUserAdd,
        lastUpdated: Date.now(),
        status: statusForSave // Use potentially updated status
      };

      // Save user message state locally immediately (without awaiting AI)
      try {
        // Pass false for shouldEncrypt, assuming handleSessionUpdate handles encryption if needed
        // It's safer to encrypt within handleSessionUpdate or ensure messages are always encrypted before this point.
        // The new SessionManager assumes handleSessionUpdate receives potentially unencrypted messages if shouldEncrypt=true.
        // Passing false means "messages are already in the state they should be saved in (e.g., unencrypted for immediate local save)"
        await SessionManager.handleSessionUpdate(
          sessionAfterUserAdd,
          messagesAfterUserAdd,
          false
        );
        console.log(
          `ChatScreen: Initial local save complete for user message ${userMessageId}`
        );
      } catch (localSaveError) {
        console.error(
          "ChatScreen: Error saving user message locally:",
          localSaveError
        );
        // Optionally inform user or rollback UI? For now, proceed.
      } finally {
        // Set loading false AFTER initial local save, BEFORE long AI call
        if (isMountedRef.current) {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      }

      // Background AI processing (do not block UI thread)
      const processAIResponse = async () => {
        let aiMessage: ChatMessage | null = null;
        let updatedUserMessageWithTranslation: ChatMessage | null = null; // To store the user message with translation

        try {
          if (!isMountedRef.current)
            throw new Error("Component unmounted before AI processing");
          // Re-check session/scenario inside async function, they might have changed
          const currentSessionForAI = currentSession;
          const currentScenarioForAI = currentScenario;
          if (!currentSessionForAI || !currentScenarioForAI)
            throw new Error("Session or Scenario missing for AI processing");

          dispatch({ type: "SET_LOADING", payload: true }); // Indicate AI processing started

          // --- Translation & AI Call ---
          // 1. Translate user text
          const translatedUserText = await OpenAIService.translateText(
            text,
            currentSessionForAI.target_language.name
          );
          if (!isMountedRef.current)
            throw new Error("Component unmounted during user translation");

          // Update the user message in the UI with the translation
          updatedUserMessageWithTranslation = {
            ...newUserMessage,
            content: { original: text, translated: translatedUserText },
          };
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              id: newUserMessage.id,
              message: updatedUserMessageWithTranslation,
            },
          });

          // 2. Prepare messages for API call (using state AFTER user message update)
          // Get the latest messages from context state *inside* the async function
          const messagesForApi = state.messages.map((m) =>
            m.id === newUserMessage.id ? updatedUserMessageWithTranslation! : m
          ); // Use the updated message

          // 3. Call AI
          const aiResponseText = await OpenAIService.generateChatCompletion(
            messagesForApi,
            currentScenarioForAI,
            currentSessionForAI.target_language.name
          );
          if (!isMountedRef.current)
            throw new Error("Component unmounted during AI generation");

          // 4. Translate AI response
          const translatedAiText = await OpenAIService.translateText(
            aiResponseText,
            "English"
          ); // Assuming target is English for display
          if (!isMountedRef.current)
            throw new Error("Component unmounted during AI translation");

          aiMessage = {
            id: generateId(),
            content: { original: aiResponseText, translated: translatedAiText },
            sender: "assistant",
            timestamp: Date.now(),
            isEdited: false,
          };
          // --- End Translation & AI Call ---

          // 5. Update State, Save, and Sync (if component still mounted)
          if (isMountedRef.current) {
            // Get latest messages state again before adding AI message
            const currentMessagesBeforeAIAdd = state.messages;
            // Ensure user message update is included
            const updatedMessagesBeforeAIAdd = currentMessagesBeforeAIAdd.map(
              (m) =>
                m.id === newUserMessage.id
                  ? updatedUserMessageWithTranslation!
                  : m
            );
            const finalMessages = [...updatedMessagesBeforeAIAdd, aiMessage];

            dispatch({ type: "ADD_MESSAGE", payload: aiMessage }); // Add AI message to local context

            // Construct final session state for saving/syncing
            // Re-fetch session from store to ensure it's the latest
            const finalSessionState: Session = {
              ...(currentSession || sessionToSend),
              messages: finalMessages,
              lastUpdated: Date.now(),
            };
            setCurrentSession(finalSessionState); // Update global store

            // Save locally (pass false for shouldEncrypt, as handleSessionUpdate should handle it)
            await SessionManager.handleSessionUpdate(
              finalSessionState,
              finalMessages,
              false
            );
            console.log(
              `ChatScreen: Final local save for ${finalSessionState.id} after AI response`
            );

            // Attempt final sync (syncToSupabase handles encryption checks)
            await SessionManager.syncToSupabase(finalSessionState);
            console.log(
              `ChatScreen: Final sync attempt for ${finalSessionState.id} finished`
            );
          }
        } catch (error) {
          console.error(
            "ChatScreen: Error during background AI processing:",
            error
          );
          if (isMountedRef.current) {
            Alert.alert(
              "Error",
              `Failed to get AI response: ${
                error instanceof Error ? error.message : "Unknown error"
              }`
            );
            // If AI fails, ensure user message translation status is updated if available
            if (updatedUserMessageWithTranslation) {
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: userMessageId,
                  message: updatedUserMessageWithTranslation,
                },
              }); // Show user translation even if AI fails
            } else {
              // Fallback if translation also failed or wasn't reached
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: userMessageId,
                  message: {
                    content: {
                      original: text,
                      translated: "(Translation failed)",
                    },
                  },
                },
              });
            }
          }
        } finally {
          if (isMountedRef.current) {
            dispatch({ type: "SET_LOADING", payload: false });
          } // Stop loading indicator
        }
      };

      // Start the background processing without awaiting it
      processAIResponse();
    },
    [
      currentSession,
      currentScenario,
      state.isLoading,
      state.status,
      state.messages,
      dispatch,
      setCurrentSession,
      scrollToBottom,
    ] // Added state.messages dependency
  );

  // --- Keep loading render ---
  // Improved loading check: show loading if context is loading AND messages are empty OR scenario is missing
  if (state.isLoading && (state.messages.length === 0 || !currentScenario)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Body1 style={{ marginTop: 20 }}>Loading conversation...</Body1>
      </View>
    );
  }

  // --- Main Render with updated FlatList ---
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Use currentScenario/currentSession from useAppStore for header/input */}
      <ChatHeader
        title={currentScenario?.title ?? "Loading Scenario..."}
        subtitle={currentSession?.target_language?.name ?? "..."}
        onBack={handleBack}
        onInfo={() => currentScenario && setShowInfo(true)} // Only allow info if scenario exists
        onEndChat={handleEndChat}
        canEndChat={state.status === "active" && state.messages.length > 0}
        condensed={condensedHeader}
      />
      {/* Banner for ended sessions only */}
      {state.status === "completed" && (
        <View style={styles.statusBanner}>
          <Text style={styles.statusText}>
            Conversation Ended
          </Text>
          <ChatButton
            variant="secondary" // Use secondary style for less emphasis
            onPress={() => router.replace("/(tabs)/scenarios")}
            style={{ paddingVertical: 4, paddingHorizontal: 12, height: 32 }}
          >
            <Text style={{ fontSize: 14, color: theme.colors.primary.main }}>
              Start New
            </Text>
          </ChatButton>
        </View>
      )}
      {/* Conditionally render FlatList only when messages exist */}
      {state.messages && state.messages.length > 0 ? (
        <FlatList
          ref={listRef}
          data={state.messages} // Use messages from local context state for list display
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ChatBubble message={item} />}
          contentContainerStyle={[
            styles.messagesList,
            // Adjust top padding based on header height and status banner visibility
            {
              paddingTop: headerHeight + (state.status !== "active" ? 60 : 20),
            }, // Add more space if banner is shown
            listPadding, // Dynamic bottom padding
          ]}
          // User interaction handlers for scroll management
          onScrollBeginDrag={() => {
            isUserScrollingRef.current = true;
          }}
          // Use onMomentumScrollEnd as the primary way to detect scroll end
          onMomentumScrollEnd={() => {
            // Add a small delay to ensure subsequent programmatic scrolls work
            setTimeout(() => {
              isUserScrollingRef.current = false;
            }, 300);
          }}
          // Update header condensation based on scroll position
          onScroll={(event) => {
            setCondensedHeader(event.nativeEvent.contentOffset.y > 50);
          }}
          scrollEventThrottle={16} // Adjust frequency of scroll events
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
                Start the conversation by sending a message.
              </Body1>
            </View>
          }
          // Added getItemLayout for performance optimization
          getItemLayout={getItemLayout}
          // Optimization props
          initialNumToRender={15} // Render fewer items initially
          maxToRenderPerBatch={10} // Render smaller batches
          windowSize={11} // Adjust the rendering window size
        />
      ) : (
        // Optionally show a different loading indicator or empty state here
        // while state.messages is empty after initial load maybe?
        // Or rely on the main loading indicator `if (state.isLoading && ...)`
        <View style={styles.emptyChat}>
          {/* You might want a different message if loading vs truly empty */}
          <Body1
            color={theme.colors.text.secondary}
            style={styles.emptyChatText}
          >
            {state.isLoading
              ? "Loading messages..."
              : "Start the conversation..."}
          </Body1>
        </View>
      )}
      {/* Input area */}
      <View
        style={styles.inputWrapper}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          // Only update if height actually changes to prevent unnecessary re-renders
          if (height !== inputHeight) {
            setInputHeight(height);
          }
        }}
      >
        <ChatInput
          onSend={handleSend}
          // --- MODIFICATION: Allow input/sending if status is 'active' or 'saved' ---
          disabled={state.status !== 'active' && state.status !== 'saved'}
          loading={state.isLoading} // Loading based on local context status
          targetLanguageName={currentSession?.target_language?.name ?? ""} // Use session from store
          status={state.status} // Pass status from context to ChatInput
          maxLength={MAX_INPUT_LENGTH} // Pass the character limit to ChatInput
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
}

// Styles (Keep existing styles)
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
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
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
    marginTop: 20,
  },
});