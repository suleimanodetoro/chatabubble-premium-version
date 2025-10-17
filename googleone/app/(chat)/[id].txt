import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  StyleSheet,
  Alert,
  AppState,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
  TextInput,
  Text,
  Keyboard, // Added Keyboard
  Platform,
  ListRenderItemInfo,
  KeyboardAvoidingView,
  // LayoutChangeEvent, // Not used in ChatInput anymore
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChatState, useChatContext } from "@/contexts/ChatContext"; // Assuming these paths are correct
import { useTheme } from "@/lib/theme/theme"; // Assuming these paths are correct
import { SessionManager } from "@/lib/services/sessionManager"; // Assuming these paths are correct
import { useAppStore } from "@/hooks/useAppStore"; // Assuming these paths are correct
import { Session, Scenario, ChatMessage } from "@/types"; // Assuming these paths are correct
import { OpenAIService } from "@/lib/services/openai"; // Assuming these paths are correct
import { generateId } from "@/lib/utils/ids"; // Assuming these paths are correct
import { Heading3, Body1, Body2, Caption } from "@/components/ui/Typography"; // Assuming these paths are correct
import { ChatBubble } from "@/components/ui/ChatBubble"; // Assuming these paths are correct
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeOut, SlideInUp } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { ProfileService } from "@/lib/services/profile"; // Assuming these paths are correct

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

// Chat button component
const ChatButton = ({ onPress, disabled, loading, style, icon, variant = "primary", children }) => {
  const theme = useTheme();
  const bg = disabled
    ? "#E5E7EB"
    : variant === "primary"
    ? theme.colors.primary.main
    : variant === "secondary"
    ? theme.colors.primary.light
    : "transparent";
  const color = disabled
    ? "#9CA3AF"
    : variant === "primary"
    ? theme.colors.primary.contrast
    : theme.colors.primary.main;
  return (
    <TouchableOpacity
      style={[styles.chatButtonBase, { backgroundColor: bg }, style]}
      onPress={onPress}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <>
          {icon && (
            <Feather
              name={icon}
              size={18}
              color={color}
              style={{ marginRight: children ? 8 : 0 }}
            />
          )}
          {children && <Text style={[styles.chatButtonText, { color }]}>{children}</Text>}
        </>
      )}
    </TouchableOpacity>
  );
};

// Chat input - simplified, no longer manages keyboardOpen or insets for padding
const ChatInput = ({ onSend, loading = false, targetLanguageName = "", status, maxLength }) => {
  const [text, setText] = useState("");
  const theme = useTheme();
  const inputRef = useRef(null);
  const isDisabled = status !== 'active' && status !== 'saved';

  const handleSend = () => {
    if (!text.trim() || isDisabled || loading) return;
    onSend(text.trim());
    setText("");
    Keyboard.dismiss();
  };

  const placeholder =
    status === 'completed'
      ? "Conversation Ended"
      : status === 'saved'
      ? "Type to resume..."
      : "Type a message...";

  return (
    <View style={styles.inputContainer}>
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
            placeholder={placeholder}
            placeholderTextColor={theme.colors.text.hint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={maxLength}
            editable={!isDisabled && !loading}
            scrollEnabled
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
        </View>
        <ChatButton
          variant="primary"
          icon="send"
          style={styles.sendButton}
          disabled={!text.trim() || isDisabled || loading}
          onPress={handleSend}
          loading={loading}
        />
      </View>
    </View>
  );
};

// Header component
const ChatHeader = ({ title, subtitle, onBack, onInfo, onEndChat, canEndChat, condensed }) => {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Calculate actual header height within the component
  const actualHeaderHeight = (condensed ? 60 : 80) + insets.top;
  return (
    <Animated.View
      style={[styles.header, { height: actualHeaderHeight, paddingTop: insets.top }]}
    >
      <BlurView style={StyleSheet.absoluteFill} tint="light" intensity={95} />
      <View style={styles.headerContent}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Feather name="chevron-left" size={24} color={theme.colors.primary.main} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Heading3 numberOfLines={1} style={styles.headerTitle}>{title}</Heading3>
          {!condensed && (
            <Body2 color={theme.colors.text.secondary} numberOfLines={1}>{subtitle}</Body2>
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

// Info card component
const ScenarioInfoCard = ({ scenario, isVisible, onClose }) => {
  if (!isVisible || !scenario) return null;
  const theme = useTheme();
  return (
    <Animated.View style={styles.infoCardContainer} entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)}>
      <BlurView style={StyleSheet.absoluteFill} tint="dark" intensity={20}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
      </BlurView>
      <Animated.View style={styles.infoCard} entering={SlideInUp.springify()}>
        <View style={styles.infoCardHandle} />
        <Heading3 style={styles.infoCardTitle}>{scenario.title}</Heading3>
        <Body1 style={styles.infoCardDescription}>{scenario.description}</Body1>
        <View style={styles.personaSection}>
          <Heading3 style={styles.sectionTitle}>Conversation Partner</Heading3>
          <View style={styles.personaContainer}>
            <View style={styles.personaAvatar}><Feather name="user" size={24} color="#fff"/></View>
            <View style={styles.personaDetails}>
              <Body1 weight="semibold">{scenario.persona.name}</Body1>
              <Body2 color={theme.colors.text.secondary}>{scenario.persona.role}</Body2>
            </View>
          </View>
          <Body1 style={styles.personalityText}>{scenario.persona.personality}</Body1>
          <View style={styles.infoTags}>
            <View style={styles.infoTag}><Caption>Style:</Caption><Caption weight="semibold" style={{marginLeft:4}}>{scenario.persona.languageStyle}</Caption></View>
            <View style={styles.infoTag}><Caption>Difficulty:</Caption><Caption weight="semibold" style={{marginLeft:4}}>{scenario.difficulty}</Caption></View>
            <View style={styles.infoTag}><Caption>Language:</Caption><Caption weight="semibold" style={{marginLeft:4}}>{scenario.target_language.name}</Caption></View>
          </View>
        </View>
        <ChatButton variant="primary" style={styles.closeButton} onPress={onClose}>Close</ChatButton>
      </Animated.View>
    </Animated.View>
  );
};

export default function ChatScreen() {
  const { id: sessionIdParam, scenarioId: scenarioIdParam, isNewSession: isNewSessionParam } = useLocalSearchParams();
  const isNewSession = isNewSessionParam === "true";
  const router = useRouter();
  const { state, dispatch } = useChatContext();
  const userId = useAppStore(s => s.user?.id);
  const source_language = useAppStore(s => s.source_language);
  const currentSessionFromStore = useAppStore(s => s.currentSession);
  const currentScenarioFromStore = useAppStore(s => s.currentScenario);
  const setCurrentSession = useAppStore(s => s.setCurrentSession);
  const setCurrentScenario = useAppStore(s => s.setCurrentScenario);

  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  
  // This headerHeight is used for paddingTop of FlatList, so it's correct.
  const headerHeight = 80 + insets.top; 

  const [showInfo, setShowInfo] = useState(false);
  const isMountedRef = useRef(true);
  const scrollTriggerTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initialScrollCompleteRef = useRef(false);
  const isUserScrollingRef = useRef(false);
  
  // Renamed from inputHeight for clarity, and set a reasonable initial non-zero value
  const [inputLayoutHeight, setInputLayoutHeight] = useState(60); 

  const [keyboardOpen, setKeyboardOpen] = useState(false);

  const DAILY_MESSAGE_LIMIT = 20;
  const MAX_INPUT_LENGTH = 500;

  // This will be dynamically calculated for FlatList's contentContainerStyle.paddingBottom
  const flatListPaddingBottom = 5; 


  useEffect(() => {
    const keyboardWillShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardOpen(true)
    );
    const keyboardWillHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardOpen(false)
    );

    return () => {
      keyboardWillShowListener.remove();
      keyboardWillHideListener.remove();
    };
  }, []);


  const scrollToBottom = useCallback((delay = 200, animated = true) => {
    if (scrollTriggerTimeoutRef.current) clearTimeout(scrollTriggerTimeoutRef.current);
    scrollTriggerTimeoutRef.current = setTimeout(() => {
      if (listRef.current && state.messages.length > 0 && !isUserScrollingRef.current && isMountedRef.current) {
        listRef.current.scrollToOffset({ offset: 9999999, animated });
      }
    }, delay);
  }, [state.messages.length]); 

  const handleBack = useCallback(() => {
    // ... (no changes in this function)
    const sessionToSave = currentSessionFromStore;
    if (!sessionToSave || state.messages.length === 0) {
      router.canGoBack() ? router.back() : router.replace("/(tabs)/scenarios");
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
            dispatch({ type: "SET_LOADING", payload: true });
            await SessionManager.handleSessionEnd(currentSessionFromStore!, state.messages, false, false);
            dispatch({ type: "SET_STATUS", payload: "saved" });
            router.canGoBack() ? router.back() : router.replace("/(tabs)/scenarios");
            dispatch({ type: "SET_LOADING", payload: false });
          },
        },
        {
          text: "End Conversation",
          style: "destructive",
          onPress: async () => {
            dispatch({ type: "SET_LOADING", payload: true });
            await SessionManager.handleSessionEnd(currentSessionFromStore!, state.messages, true, false);
            dispatch({ type: "SET_STATUS", payload: "completed" });
            router.canGoBack() ? router.back() : router.replace("/(tabs)/scenarios");
            dispatch({ type: "SET_LOADING", payload: false });
          },
        },
      ]
    );
  }, [currentSessionFromStore, state.messages, dispatch, router]);

  const handleEndChat = useCallback(() => {
    // ... (no changes in this function)
    Alert.alert(
      "End Conversation",
      "Are you sure you want to end this conversation?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            dispatch({ type: "SET_LOADING", payload: true });
            await SessionManager.handleSessionEnd(currentSessionFromStore!, state.messages, true, false);
            dispatch({ type: "SET_STATUS", payload: "completed" });
            router.canGoBack() ? router.back() : router.replace("/(tabs)/scenarios");
            dispatch({ type: "SET_LOADING", payload: false });
          },
        },
      ]
    );
  }, [currentSessionFromStore, state.messages, dispatch, router]);

  const handleSend = useCallback(async (text: string) => {
    // ... (no changes in this function)
    if (!userId) { Alert.alert("Error", "User not found."); return; }
    if (!currentSessionFromStore || !currentScenarioFromStore) {
      Alert.alert("Error", "Session or scenario not loaded.");
      return;
    }

    const { allowed } = await ProfileService.checkAndIncrementMessageCount(userId, DAILY_MESSAGE_LIMIT);
    if (!allowed) { Alert.alert("Daily Limit Reached", `You have reached the daily message limit of ${DAILY_MESSAGE_LIMIT} messages.`); return; }

    if (text.length > MAX_INPUT_LENGTH) { Alert.alert("Message Too Long", `Your message exceeds the maximum length of ${MAX_INPUT_LENGTH} characters.`); return; }

    if (state.status === "saved" && currentSessionFromStore) {
      dispatch({ type: "SET_STATUS", payload: "active" }); 
      setCurrentSession({ ...currentSessionFromStore, status: 'active', lastUpdated: Date.now() });
    }

    const userMsg: ChatMessage = { id: generateId(), content: { original: text, translated: "Translating..." }, sender: "user", timestamp: Date.now(), isEdited: false };
    dispatch({ type: "ADD_MESSAGE", payload: userMsg });
    scrollToBottom(100); 

    const updatedSessionMessages = [...state.messages, userMsg];
    const updatedSession: Session = { ...currentSessionFromStore, messages: updatedSessionMessages, lastUpdated: Date.now(), status: 'active' };
    setCurrentSession(updatedSession); 
    await SessionManager.handleSessionUpdate(updatedSession, updatedSessionMessages, false);

    try {
      dispatch({ type: "SET_LOADING", payload: true });
      const translatedUserText = await OpenAIService.translateText(text, currentSessionFromStore.target_language.name);
      const updatedUserMsg = { ...userMsg, content: { original: text, translated: translatedUserText } };
      dispatch({ type: "UPDATE_MESSAGE", payload: { id: userMsg.id, message: updatedUserMsg } });
      
      const messagesForAI = [...state.messages.filter(m => m.id !== userMsg.id), updatedUserMsg];

      const aiText = await OpenAIService.generateChatCompletion(messagesForAI, currentScenarioFromStore, currentSessionFromStore.target_language.name);
      const aiTranslatedToEnglish = await OpenAIService.translateText(aiText, "English"); 
      
      const aiMsg: ChatMessage = { id: generateId(), content: { original: aiText, translated: aiTranslatedToEnglish }, sender: "assistant", timestamp: Date.now(), isEdited: false };
      dispatch({ type: "ADD_MESSAGE", payload: aiMsg });

      const finalSessionMessages = [...messagesForAI, aiMsg];
      const finalSession: Session = { ...currentSessionFromStore, messages: finalSessionMessages, lastUpdated: Date.now(), status: 'active' };
      setCurrentSession(finalSession);
      await SessionManager.handleSessionUpdate(finalSession, finalSessionMessages, false);
      await SessionManager.syncToSupabase(finalSession); 

    } catch (err) {
      console.error("Error during AI response or translation:", err);
      Alert.alert("Error", "Failed to get AI response or translate message. Please try again.");
    } finally {
      dispatch({ type: "SET_LOADING", payload: false });
    }
  }, [userId, state.status, state.messages, currentSessionFromStore, currentScenarioFromStore, dispatch, setCurrentSession, scrollToBottom, source_language]);


  useEffect(() => {
    // ... (no changes in this function)
    isMountedRef.current = true;
    let timeoutId: NodeJS.Timeout;
    const loadState = async () => {
      if (!userId || !sessionIdParam || !scenarioIdParam) {
        if (isMountedRef.current) dispatch({ type: "SET_LOADING", payload: false });
        return;
      }
      dispatch({ type: "SET_LOADING", payload: true });
      try {
        const result = await SessionManager.loadOrCreateSession(sessionIdParam, scenarioIdParam, userId, isNewSession, source_language, dispatch);
        if (!isMountedRef.current) return;
        if (result) {
          const { session, scenario, messages } = result;
          dispatch({ type: "SET_SESSION", payload: session.id });
          dispatch({ type: "LOAD_MESSAGES", payload: messages });
          dispatch({ type: "SET_STATUS", payload: session.status });
          setCurrentSession(session);
          setCurrentScenario(scenario);
          timeoutId = setTimeout(() => {
            if (listRef.current && isMountedRef.current) {
              scrollToBottom(0, false);
              initialScrollCompleteRef.current = true;
            }
          }, 300); 
        } else {
          if (isMountedRef.current) Alert.alert("Error", "Could not load session data.");
        }
      } catch (error) {
        console.error("Failed to load session state:", error);
        if (isMountedRef.current) Alert.alert("Error", "An error occurred while loading the session.");
      } finally {
        if (isMountedRef.current) dispatch({ type: "SET_LOADING", payload: false });
      }
    };

    loadState();

    return () => {
      isMountedRef.current = false;
      if (timeoutId) clearTimeout(timeoutId);
      if (scrollTriggerTimeoutRef.current) clearTimeout(scrollTriggerTimeoutRef.current);
    };
  }, [sessionIdParam, scenarioIdParam, userId, isNewSession, dispatch, setCurrentSession, setCurrentScenario, source_language, scrollToBottom]);


  useEffect(() => {
    // ... (no changes in this function)
    const subscription = AppState.addEventListener("change", nextAppState => {
      if (
        nextAppState.match(/inactive|background/) &&
        state.status === 'active' &&
        currentSessionFromStore &&
        state.messages.length > 0 
      ) {
        SessionManager.handleSessionEnd(
          { ...currentSessionFromStore, messages: state.messages, status: 'saved', lastUpdated: Date.now() },
          state.messages,
          false, 
          false  
        );
      }
    });

    return () => {
      subscription.remove();
    };
  }, [state.status, state.messages, currentSessionFromStore]);


  useEffect(() => {
    if (initialScrollCompleteRef.current && !isUserScrollingRef.current && state.messages.length > 0) {
      scrollToBottom(Platform.OS === 'ios' ? 150 : 300); 
    }
  }, [state.messages.length, scrollToBottom]); 

  if (state.isLoading && !initialScrollCompleteRef.current) { 
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Body1 style={{ marginTop: 20 }}>Loading conversation...</Body1>
      </View>
    );
  }

  if (!currentScenarioFromStore || !currentSessionFromStore) {
    return (
      <View style={styles.loadingContainer}>
        <Body1>Preparing chat...</Body1>
      </View>
    );
  }


  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"} 
      // Critical change: If ChatHeader is INSIDE KAV, offset should be 0 for iOS "padding" behavior.
      // For Android "height" behavior, offset is typically not used or 0.
      keyboardVerticalOffset={0} 
    >
      <Stack.Screen options={{ headerShown: false }} />
      <ChatHeader
        title={currentScenarioFromStore.title}
        subtitle={currentSessionFromStore.target_language.name}
        onBack={handleBack}
        onInfo={() => setShowInfo(true)}
        onEndChat={handleEndChat}
        canEndChat={state.status === "active" && state.messages.length > 0}
        condensed={false} 
      />
      {state.status === "completed" && (
        <View style={[styles.statusBanner, {top: headerHeight - insets.top + 10 }]}>
          <Text style={styles.statusText}>Conversation Ended</Text>
          <ChatButton variant="secondary" onPress={() => router.replace("/(tabs)/scenarios")} style={styles.statusBannerButton}>
            <Text style={styles.statusBannerButtonText}>Start New</Text>
          </ChatButton>
        </View>
      )}
      <FlatList
        ref={listRef}
        style={styles.list}
        data={state.messages}
        keyExtractor={item => item.id}
        renderItem={({ item }: ListRenderItemInfo<ChatMessage>) => <ChatBubble message={item} />}
        contentContainerStyle={[
          styles.messagesList,
          {
            paddingTop: headerHeight + (state.status === "completed" ? 50 : 10), 
            paddingBottom: flatListPaddingBottom, // Use dynamically calculated padding
          },
          // listPadding was { paddingBottom: 5 }, now incorporated into flatListPaddingBottom
        ]}
        onScrollBeginDrag={() => { isUserScrollingRef.current = true; }}
        onScrollEndDrag={() => { 
            setTimeout(() => { isUserScrollingRef.current = false; }, 500);
        }}
        onMomentumScrollEnd={() => { 
            // setTimeout(() => { isUserScrollingRef.current = false; }, 300);
        }}
        keyboardDismissMode="interactive" 
        onLayout={() => {
            if (!initialScrollCompleteRef.current && state.messages.length > 0) {
                // scrollToBottom(500, false); 
            }
        }}
      />
      <View
        style={[
          styles.inputWrapper,
          !keyboardOpen && { paddingBottom: insets.bottom }
        ]}
        onLayout={({ nativeEvent }) => {
          const newHeight = nativeEvent.layout.height;
          // Ensure we only set a positive height and if it has changed
          if (newHeight > 0 && newHeight !== inputLayoutHeight) { 
            setInputLayoutHeight(newHeight);
          }
        }}
      >
        <ChatInput
          onSend={handleSend}
          loading={state.isLoading && initialScrollCompleteRef.current} 
          targetLanguageName={currentSessionFromStore.target_language.name}
          status={state.status}
          maxLength={MAX_INPUT_LENGTH}
        />
      </View>
      <ScenarioInfoCard scenario={currentScenarioFromStore} isVisible={showInfo} onClose={() => setShowInfo(false)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F9FAFB" },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent' },
  headerContent: { flexDirection: "row", alignItems: "center", flex: 1, paddingHorizontal: 16 },
  backButton: { padding: 8, marginRight: 8, marginLeft: -8 },
  headerTitleContainer: { flex: 1, justifyContent: "center", alignItems: 'center', marginHorizontal: 8 },
  headerTitle: { textAlign: "center" }, 
  headerActions: { flexDirection: "row", alignItems: "center" },
  endChatHeaderButton: { padding: 8, marginRight: 4 },
  infoButton: { padding: 8, marginLeft: 4 },
  statusBanner: {
    position: "absolute",
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
  statusText: { color: "#B91C1C", fontSize: 14, fontWeight: "500" }, 
  statusBannerButton: { paddingVertical: 4, paddingHorizontal: 12, height: 32, backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: 16 },
  statusBannerButtonText: { fontSize: 14, color: '#DC2626', fontWeight: '500' }, 
  list: { flex: 1 },
  messagesList: { paddingHorizontal: 16, }, 
  inputWrapper: {
    backgroundColor: "#fff", 
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)", 
  },
  inputContainer: { 
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  languageIndicator: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8, paddingHorizontal: 4, alignSelf: 'flex-start' },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingBottom: 8 },
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
    justifyContent: 'center', 
  },
  disabledInput: { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" },
  textInput: {
    fontSize: 16,
    color: '#1E293B', 
    paddingTop: 0, 
    paddingBottom: 0, 
  },
  sendButton: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  chatButtonBase: { height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, flexDirection: 'row' },
  chatButtonText: { fontWeight: '600', fontSize: 16 },
  infoCardContainer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, justifyContent: "flex-end", zIndex: 20 },
  infoCard: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingTop: 12, paddingBottom: 34 , maxHeight: "80%", shadowColor: "#000", shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  infoCardHandle: { width: 40, height: 4, backgroundColor: "#CBD5E1", borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  infoCardTitle: { marginBottom: 8, textAlign: 'center' },
  infoCardDescription: { marginBottom: 24, opacity: 0.8, textAlign: 'center' },
  sectionTitle: { marginBottom: 12, fontSize: 18, color: '#374151' },
  personaSection: { marginBottom: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' },
  personaContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16, backgroundColor: '#F9FAFB', padding: 12, borderRadius: 12 },
  personaAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#4A6FFF", alignItems: "center", justifyContent: "center", marginRight: 12 },
  personaDetails: { flex: 1 },
  personalityText: { marginBottom: 16, fontStyle: 'italic', color: '#6B7280' },
  infoTags: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  infoTag: { flexDirection: "row", alignItems: "center", backgroundColor: '#F3F4F6', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  closeButton: { alignSelf: "center", minWidth: 120, marginTop: 24 },
});

