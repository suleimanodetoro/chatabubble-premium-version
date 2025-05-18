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
  Platform,
  ListRenderItemInfo,
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
import { Dispatch } from "react";
import { OpenAIService } from "@/lib/services/openai";
import { generateId } from "@/lib/utils/ids";
import { Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Feather } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInUp,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { ProfileService } from "@/lib/services/profile";
import { StorageService } from "@/lib/services/storage";

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// --- Helper Components (Copied from original for brevity, assume they are correct) ---
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
    if (disabled) return "#E5E7EB";
    if (variant === "primary") return theme.colors.primary.main;
    if (variant === "secondary") return theme.colors.primary.light;
    return "transparent";
  };
  const getTextColor = () => {
    if (disabled) return "#9CA3AF";
    if (variant === "primary") return theme.colors.primary.contrast;
    return theme.colors.primary.main;
  };
  return (
    <TouchableOpacity
      style={[
        styles.chatButtonBase,
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
    Keyboard.dismiss();
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
      {targetLanguageName && status === 'active' && (
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
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
        </View>
        <ChatButton
          variant="primary"
          icon="send"
          style={[styles.sendButton]}
          disabled={!text.trim() || isDisabled || loading}
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

export default function ChatScreen() {
  console.log("DEBUG: ChatScreen mounted");

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
  const { state, dispatch } = useChatContext();
  const userId = useAppStore(state => state.user?.id);
  const source_language = useAppStore(state => state.source_language);
  const currentSessionFromStore = useAppStore(state => state.currentSession); // Renamed to avoid conflict
  const currentScenarioFromStore = useAppStore(state => state.currentScenario); // Renamed
  const setCurrentSession = useAppStore(state => state.setCurrentSession);
  const setCurrentScenario = useAppStore(state => state.setCurrentScenario);

  const isMountedRef = useRef(true);
  const [showInfo, setShowInfo] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);
  const headerHeight = 80 + insets.top;
  const [condensedHeader, setCondensedHeader] = useState(false);
  const [inputHeight, setInputHeight] = useState(80);
  const isUserScrollingRef = useRef(false);
  const scrollTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialScrollCompleteRef = useRef(false);

  const listPadding = { paddingBottom: inputHeight + 20 };

  const DAILY_MESSAGE_LIMIT = 20;
  const MAX_INPUT_LENGTH = 500;

  const scrollToBottom = useCallback((delay = 200, animated = true) => {
      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
      scrollTriggerTimeoutRef.current = setTimeout(() => {
        if (
          listRef.current &&
          state.messages.length > 0 && // Use context state here
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
    }, [state.messages.length]); // Depend on context's messages length

  const handleEndChat = useCallback(() => {
    const sessionToEnd = currentSessionFromStore; // Use from store
    if (!sessionToEnd) {
      console.warn("handleEndChat called but currentSession is null/undefined in store");
      return;
    }
    const currentMessages = state.messages; // Use from context

    Alert.alert(
      "End Conversation",
      "Are you sure you want to end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
             const finalSessionToEnd = useAppStore.getState().currentSession;
             const finalMessages = state.messages; // Re-read from context state
            if (!isMountedRef.current || !finalSessionToEnd) return;
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(
                finalSessionToEnd,
                finalMessages,
                true,
                false
              );
              dispatch({ type: "SET_STATUS", payload: "completed" });
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
  }, [dispatch, router, currentSessionFromStore, state.messages]); // Use store and context states

  const handleBack = useCallback(() => {
    const sessionToSave = currentSessionFromStore; // Use from store
    const currentMessages = state.messages; // Use from context

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
             const finalMessages = state.messages; // Re-read from context
            if (!isMountedRef.current || !finalSessionToSave) return;
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(finalSessionToSave, finalMessages, false, false);
              dispatch({ type: "SET_STATUS", payload: "saved" });
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
             const finalMessages = state.messages; // Re-read from context
            if (!isMountedRef.current || !finalSessionToEnd) return;
            try {
              dispatch({ type: "SET_LOADING", payload: true });
              await SessionManager.handleSessionEnd(finalSessionToEnd, finalMessages, true, false);
              dispatch({ type: "SET_STATUS", payload: "completed" });
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
  }, [router, dispatch, currentSessionFromStore, state.messages]); // Use store and context states

  const handleSend = useCallback(
    async (text: string) => {
      const sessionToSend = currentSessionFromStore; // Use from store
      const scenarioToSend = currentScenarioFromStore; // Use from store
      const currentUserId = userId;
      const chatContextState = state; // Use from context

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

      const canSend = (chatContextState.status === "active" || chatContextState.status === "saved");
      if (!sessionToSend || !scenarioToSend || !text.trim() || chatContextState.isLoading || !canSend || !isMountedRef.current) {
        console.log("handleSend blocked:", { hasSession: !!sessionToSend, hasScenario: !!scenarioToSend, text: !!text.trim(), isLoading: chatContextState.isLoading, canSend, status: chatContextState.status, isMounted: isMountedRef.current });
        return;
      }
      if (text.length > MAX_INPUT_LENGTH) {
        Alert.alert("Message Too Long", `Please keep your message under ${MAX_INPUT_LENGTH} characters.`);
        return;
      }

      if (chatContextState.status === "saved") {
        dispatch({ type: "SET_STATUS", payload: "active" });
        setCurrentSession({ ...sessionToSend, status: 'active', lastUpdated: Date.now() });
        console.log("ChatScreen: Status changed from 'saved' to 'active' on send.");
      }

      const userMessageId = generateId();
      const newUserMessage: ChatMessage = {
        id: userMessageId,
        content: { original: text, translated: "..." },
        sender: "user",
        timestamp: Date.now(),
        isEdited: false,
      };

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "ADD_MESSAGE", payload: newUserMessage });
      Keyboard.dismiss();
      scrollToBottom(100);

      // The state.messages in the closure is the one *before* ADD_MESSAGE.
      const messagesBeforeUserAdd = chatContextState.messages;

      const sessionAfterUserAdd: Session = {
        ...sessionToSend,
        messages: [...messagesBeforeUserAdd, newUserMessage], // Manually add for local save
        lastUpdated: Date.now(),
        status: 'active' // Ensure status is active for saving
      };

      try {
        await SessionManager.handleSessionUpdate(
          sessionAfterUserAdd,
          [...messagesBeforeUserAdd, newUserMessage], // Pass the constructed list
          false
        );
        console.log(`ChatScreen: Initial local save complete for user message ${userMessageId}`);
      } catch (localSaveError) {
        console.error("ChatScreen: Error saving user message locally:", localSaveError);
      } finally {
        if (isMountedRef.current) {
          dispatch({ type: "SET_LOADING", payload: false });
        }
      }

      const processAIResponse = async () => {
        let aiMessage: ChatMessage | null = null;
        let updatedUserMessageWithTranslation: ChatMessage | null = null;

        try {
          if (!isMountedRef.current) throw new Error("Component unmounted before AI processing");

          const currentSessionForAI = useAppStore.getState().currentSession;
          const currentScenarioForAI = useAppStore.getState().currentScenario;
          if (!currentSessionForAI || !currentScenarioForAI) throw new Error("Session or Scenario missing for AI processing");

          dispatch({ type: "SET_LOADING", payload: true });

          const translatedUserText = await OpenAIService.translateText(
            text,
            currentSessionForAI.target_language.name
          );
          if (!isMountedRef.current) throw new Error("Component unmounted during user translation");

          updatedUserMessageWithTranslation = {
            ...newUserMessage,
            content: { original: text, translated: translatedUserText },
          };
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: { id: newUserMessage.id, message: updatedUserMessageWithTranslation },
          });
          
          // CORRECTED: Construct messagesForAI using the closure's state.messages (before ADD_MESSAGE)
          // and append the fully formed updatedUserMessageWithTranslation.
          const messagesForAI = [...messagesBeforeUserAdd, updatedUserMessageWithTranslation];

          const aiResponseText = await OpenAIService.generateChatCompletion(
            messagesForAI, // Use the corrected list
            currentScenarioForAI,
            currentSessionForAI.target_language.name
          );
          if (!isMountedRef.current) throw new Error("Component unmounted during AI generation");

          const translatedAiText = await OpenAIService.translateText(
            aiResponseText,
            "English"
          );
          if (!isMountedRef.current) throw new Error("Component unmounted during AI translation");

          aiMessage = {
            id: generateId(),
            content: { original: aiResponseText, translated: translatedAiText },
            sender: "assistant",
            timestamp: Date.now(),
            isEdited: false,
          };

          if (isMountedRef.current) {
            // The context's state.messages will have been updated by ADD_MESSAGE and UPDATE_MESSAGE.
            // So, when we ADD_MESSAGE for aiMessage, it appends to the correct list.
            dispatch({ type: "ADD_MESSAGE", payload: aiMessage });

            // Construct final session state for saving/syncing
            // Get the latest messages from the context after all dispatches for user and AI messages
            const finalMessages = [...messagesForAI, aiMessage]; // This is the most accurate list now

            const finalSessionState: Session = {
              ...(useAppStore.getState().currentSession || sessionToSend),
              messages: finalMessages,
              lastUpdated: Date.now(),
              status: 'active',
            };
            setCurrentSession(finalSessionState);

            await SessionManager.handleSessionUpdate(finalSessionState, finalMessages, false);
            console.log(`ChatScreen: Final local save for ${finalSessionState.id} after AI response`);

            await SessionManager.syncToSupabase(finalSessionState);
            console.log(`ChatScreen: Final sync attempt for ${finalSessionState.id} finished`);
          }
        } catch (error) {
          console.error("ChatScreen: Error during background AI processing:", error);
          if (isMountedRef.current) {
            Alert.alert("Error", `Failed to get AI response: ${error instanceof Error ? error.message : "Unknown error"}`);
            dispatch({
              type: "UPDATE_MESSAGE",
              payload: {
                id: userMessageId,
                message: {
                  ...newUserMessage, // Use the original newUserMessage structure
                  content: {
                    original: text, // Keep original text
                    translated: updatedUserMessageWithTranslation?.content.translated ?? "(Translation failed)",
                  },
                },
              },
            });
          }
        } finally {
          if (isMountedRef.current) {
            dispatch({ type: "SET_LOADING", payload: false });
          }
        }
      };
      processAIResponse();
    },
    [dispatch, scrollToBottom, userId, currentSessionFromStore, currentScenarioFromStore, state, setCurrentSession]
  );

  useEffect(() => {
    console.log("DEBUG: ChatScreen AppState useEffect setup.");
    const appStateSubscription = AppState.addEventListener("change", (nextAppState) => {
        const session = useAppStore.getState().currentSession;
        const messagesCtx = state.messages; // Use from context
        const statusCtx = state.status;   // Use from context
        const scenario = useAppStore.getState().currentScenario;
        const currentUserId = useAppStore.getState().user?.id;
        const currentSourceLang = useAppStore.getState().source_language;

        if (
          session &&
          messagesCtx.length > 0 &&
          (nextAppState === "background" || nextAppState === "inactive") &&
          statusCtx === 'active'
        ) {
          console.log(`ChatScreen: App state changed to ${nextAppState}. Saving session ${session.id}...`);
          const sessionToSaveOnBackground: Session = {
            id: session.id,
            userId: currentUserId || "",
            scenarioId: scenario?.id || "",
            target_language: scenario?.target_language || { code: "en", name: "English", direction: "ltr" },
            source_language: currentSourceLang || { code: "en", name: "English", direction: "ltr" },
            messages: [], // Messages will be taken from context by handleSessionEnd
            startTime: session.startTime || Date.now(),
            lastUpdated: Date.now(),
            scenario: scenario || undefined,
            status: 'saved', // Explicitly set to saved
          };

          SessionManager.handleSessionEnd(sessionToSaveOnBackground, messagesCtx, false, false)
            .then(() => console.log(`Session ${session.id} saved on background.`))
            .catch((error) => console.error("SessionManager: Error saving session on app state change:", error));
        }
      }
    );

    isMountedRef.current = true;
    return () => {
      console.log(`\n🚨 DEBUG: ChatScreen AppState Cleanup Triggered! 🚨\n`);
      isMountedRef.current = false;
      appStateSubscription.remove();
      if (scrollTriggerTimeoutRef.current) {
        clearTimeout(scrollTriggerTimeoutRef.current);
      }
    };
  }, [state.messages, state.status]); // Depend on context state

  useEffect(() => {
    let loadTimeoutId: NodeJS.Timeout | null = null;
    let isMounted = true;
    isMountedRef.current = true;

    const currentSourceLangVal = source_language; // Capture from hook scope
    const routerRef = router;
    const dispatchRef = dispatch;
    const setCurrentScenarioRef = setCurrentScenario;
    const setCurrentSessionRef = setCurrentSession;

    async function loadChatState() {
        console.log("DEBUG: Loading useEffect starting...");
        const sessionId = typeof sessionIdParam === "string" ? sessionIdParam : undefined;
        const scenarioId = typeof scenarioIdParam === "string" ? scenarioIdParam : undefined;

        if (!sessionId || !scenarioId) {
            console.error("ChatScreen: Missing session ID or scenario ID parameter.");
            if(isMounted) Alert.alert("Error", "Could not load chat session (missing ID).");
            if(routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(tabs)/scenarios");
            return;
        }
        if (!userId) {
            console.error("ChatScreen: User ID not available.");
            if(isMounted) Alert.alert("Error", "User information not available.");
            if(routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(auth)/login");
            return;
        }
        if (isNewSession && !currentSourceLangVal) {
            console.error("ChatScreen: Source language not available for new session.");
             if(isMounted) Alert.alert("Error", "Default language information not available.");
            if(routerRef.canGoBack()) routerRef.back(); else routerRef.replace("/(tabs)/scenarios");
            return;
        }

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
            sessionId, scenarioId, userId, isNewSession, currentSourceLangVal, dispatchRef
          );
          console.log(`DEBUG: SessionManager.loadOrCreateSession call completed for ${sessionId}`);

          if (!isMounted) { console.log("DEBUG: Component unmounted during load/create"); return; }

          if (result && result.session && result.scenario) {
            const { session: loadedSession, scenario: loadedScenario, messages: loadedMessages } = result;
            console.log(`DEBUG: Loaded/Created Session Status: ${loadedSession.status}, Messages: ${loadedMessages.length}`);

            dispatchRef({ type: "SET_SESSION", payload: loadedSession.id });
            dispatchRef({ type: "LOAD_MESSAGES", payload: loadedMessages });
            dispatchRef({ type: "SET_STATUS", payload: loadedSession.status });

            setCurrentScenarioRef(loadedScenario);
            setCurrentSessionRef(loadedSession);
            console.log("DEBUG: Global State updates complete.");

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

    return () => {
      console.log("DEBUG: Loading useEffect cleanup running.");
      isMounted = false;
      isMountedRef.current = false;
      if (loadTimeoutId) {
        clearTimeout(loadTimeoutId);
      }
    };
  }, [ sessionIdParam, scenarioIdParam, isNewSessionParam, userId, dispatch, router, setCurrentScenario, setCurrentSession, source_language ]); // Added source_language

  useEffect(() => {
    if (
      state.messages.length > 0 &&
      initialScrollCompleteRef.current &&
      !isUserScrollingRef.current
    ) {
      scrollToBottom(300, true);
    }
  }, [state.messages.length, scrollToBottom]);

  const getItemLayout = useCallback((data: any, index: number) => {
    const ESTIMATED_ITEM_HEIGHT = 80;
    return {
      length: ESTIMATED_ITEM_HEIGHT,
      offset: ESTIMATED_ITEM_HEIGHT * index,
      index
    };
  }, []);

  if (state.isLoading && (state.messages.length === 0 || !currentScenarioFromStore)) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Body1 style={{ marginTop: 20 }}>Loading conversation...</Body1>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <ChatHeader
        title={currentScenarioFromStore?.title ?? "Loading Scenario..."}
        subtitle={currentSessionFromStore?.target_language?.name ?? "..."}
        onBack={handleBack}
        onInfo={() => currentScenarioFromStore && setShowInfo(true)}
        onEndChat={handleEndChat}
        canEndChat={state.status === "active" && state.messages.length > 0}
        condensed={condensedHeader}
      />

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

      <FlatList
        ref={listRef}
        data={state.messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }: ListRenderItemInfo<ChatMessage>) => <ChatBubble message={item} />}
        contentContainerStyle={[
          styles.messagesList,
          { paddingTop: headerHeight + (state.status === "completed" ? 60 : 20) },
          listPadding,
        ]}
        onScrollBeginDrag={() => { isUserScrollingRef.current = true; }}
        onMomentumScrollEnd={() => { setTimeout(() => { isUserScrollingRef.current = false; }, 300); }}
        onScroll={(event) => { setCondensedHeader(event.nativeEvent.contentOffset.y > 50); }}
        scrollEventThrottle={16}
        ListEmptyComponent={
          !state.isLoading ? (
            <View style={styles.emptyChat}>
              <View style={styles.emptyIconContainer}>
                <Feather name="message-circle" size={40} color={theme.colors.text.hint} />
              </View>
              <Body1 color={theme.colors.text.secondary} style={styles.emptyChatText}>
                Start the conversation by sending a message.
              </Body1>
            </View>
          ) : null
        }
        getItemLayout={getItemLayout}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={11}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        inverted={false}
      />

      <View
        style={styles.inputWrapper}
        onLayout={(event) => {
          const height = event.nativeEvent.layout.height;
          if (height !== inputHeight) setInputHeight(height);
        }}
      >
        <ChatInput
          onSend={handleSend}
          loading={state.isLoading} // Use context isLoading
          targetLanguageName={currentSessionFromStore?.target_language?.name ?? ""}
          status={state.status}
          maxLength={MAX_INPUT_LENGTH}
        />
      </View>

      <ScenarioInfoCard
        scenario={currentScenarioFromStore}
        isVisible={showInfo}
        onClose={() => setShowInfo(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
    marginLeft: -8,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: 'center',
    marginHorizontal: 8,
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
    marginLeft: 4,
  },
  statusBanner: {
    position: "absolute",
    top: 100, 
    left: 16,
    right: 16,
    backgroundColor: "#FEF2F2", 
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
    color: "#B91C1C", 
    fontSize: 14,
    fontWeight: "500",
  },
   statusBannerButton: {
       paddingVertical: 4,
       paddingHorizontal: 12,
       height: 32,
       backgroundColor: 'rgba(220, 38, 38, 0.1)', 
       borderRadius: 16,
   },
   statusBannerButtonText: {
       fontSize: 14,
       color: '#DC2626', 
       fontWeight: '500',
   },
  messagesList: {
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    justifyContent: 'center',
    alignItems: "center",
    padding: 20,
    marginTop: 100,
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
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
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
    alignSelf: 'flex-start',
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  textInputContainer: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    flexDirection: "row",
    alignItems: "center",
  },
  disabledInput: {
    backgroundColor: "#F3F4F6",
    borderColor: "#E5E7EB",
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingTop: 0,
    paddingBottom: 0,
  },
  voiceButton: {
    padding: 8,
    marginLeft: 4,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10,
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
    textAlign: 'center',
  },
  infoCardDescription: {
    marginBottom: 24,
    opacity: 0.8,
    textAlign: 'center',
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
    color: '#374151',
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
    fontStyle: 'italic',
    color: '#6B7280',
  },
  infoTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
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
    marginTop: 24,
  },
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

